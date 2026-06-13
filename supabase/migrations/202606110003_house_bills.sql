create type public.bill_frequency as enum ('one_time', 'weekly', 'monthly', 'yearly');

create table public.house_bills (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  amount numeric(12,2) not null check (amount > 0),
  frequency public.bill_frequency not null default 'monthly',
  due_day smallint check (due_day between 1 and 31),
  next_due_date date,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.house_bill_shares (
  bill_id uuid not null references public.house_bills(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  primary key (bill_id, user_id)
);

alter table public.house_bills enable row level security;
alter table public.house_bill_shares enable row level security;

create policy "Members can view house bills" on public.house_bills for select to authenticated
using (public.is_house_member(house_id));

create policy "Members can view bill shares" on public.house_bill_shares for select to authenticated
using (exists(select 1 from public.house_bills where id = bill_id and public.is_house_member(house_id)));

create or replace function public.create_house_bill(
  target_house_id uuid,
  bill_name text,
  bill_amount numeric,
  bill_frequency public.bill_frequency,
  bill_next_due_date date,
  shares jsonb
) returns public.house_bills
language plpgsql security definer set search_path = public as $$
declare created_bill public.house_bills;
declare share_total numeric;
declare share_item jsonb;
declare share_user uuid;
begin
  if not public.can_manage_house(target_house_id) then raise exception 'Only house managers can create bills'; end if;
  select coalesce(sum((item->>'amount')::numeric), 0) into share_total from jsonb_array_elements(shares) item;
  if round(share_total, 2) <> round(bill_amount, 2) then raise exception 'Bill shares must equal the bill amount'; end if;

  if bill_next_due_date is null then raise exception 'A payment date is required'; end if;
  insert into public.house_bills(house_id, name, amount, frequency, next_due_date, due_day, created_by)
  values (target_house_id, bill_name, bill_amount, bill_frequency, bill_next_due_date, extract(day from bill_next_due_date), auth.uid())
  returning * into created_bill;

  for share_item in select * from jsonb_array_elements(shares) loop
    share_user := (share_item->>'user_id')::uuid;
    if not exists(select 1 from public.house_members where house_id = target_house_id and user_id = share_user) then
      raise exception 'Every bill share must belong to a house member';
    end if;
    insert into public.house_bill_shares(bill_id, user_id, amount)
    values (created_bill.id, share_user, round((share_item->>'amount')::numeric, 2));
  end loop;
  return created_bill;
end; $$;

grant execute on function public.create_house_bill(uuid, text, numeric, public.bill_frequency, date, jsonb) to authenticated;
