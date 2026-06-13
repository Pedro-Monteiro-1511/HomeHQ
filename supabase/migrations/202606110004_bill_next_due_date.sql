alter table public.house_bills
  add column if not exists next_due_date date;

drop function if exists public.create_house_bill(uuid, text, numeric, public.bill_frequency, smallint, jsonb);

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
  if bill_next_due_date is null then raise exception 'A payment date is required'; end if;
  select coalesce(sum((item->>'amount')::numeric), 0) into share_total from jsonb_array_elements(shares) item;
  if round(share_total, 2) <> round(bill_amount, 2) then raise exception 'Bill shares must equal the bill amount'; end if;

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
