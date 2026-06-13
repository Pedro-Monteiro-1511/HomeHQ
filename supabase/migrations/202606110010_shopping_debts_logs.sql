create type public.shopping_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.shopping_scope as enum ('house', 'personal');

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  priority public.shopping_priority not null default 'normal',
  scope public.shopping_scope not null default 'house',
  requested_by uuid not null references public.profiles(id),
  personal_for uuid references public.profiles(id),
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price > 0),
  purchased_price numeric(12,2) check (purchased_price is null or purchased_price > 0),
  purchased_by uuid references public.profiles(id),
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.member_debts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  debtor_id uuid not null references public.profiles(id),
  creditor_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  source_type text not null,
  source_id uuid,
  description text not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint different_debt_members check (debtor_id <> creditor_id)
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  house_id uuid not null references public.houses(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.shopping_items enable row level security;
alter table public.member_debts enable row level security;
alter table public.activity_logs enable row level security;

create policy "Shopping viewers can view items" on public.shopping_items for select to authenticated using (public.can_view_section(house_id, 'shopping'));
create policy "Finance viewers can view debts" on public.member_debts for select to authenticated using (public.can_view_section(house_id, 'finance'));
create policy "Dashboard viewers can view logs" on public.activity_logs for select to authenticated using (public.can_view_section(house_id, 'dashboard'));

create or replace function public.add_shopping_item(
  target_house uuid, item_name text, item_priority public.shopping_priority,
  item_scope public.shopping_scope, item_personal_for uuid default null, item_estimated_price numeric default null
) returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare created_item public.shopping_items;
begin
  if not public.can_edit_section(target_house, 'shopping') then raise exception 'Permission denied'; end if;
  if item_scope = 'personal' and item_personal_for is null then item_personal_for := auth.uid(); end if;
  if item_personal_for is not null and not exists(select 1 from public.house_members where house_id = target_house and user_id = item_personal_for) then raise exception 'Personal recipient must be a house member'; end if;
  insert into public.shopping_items(house_id, name, priority, scope, requested_by, personal_for, estimated_price)
  values(target_house, item_name, item_priority, item_scope, auth.uid(), case when item_scope = 'personal' then item_personal_for else null end, item_estimated_price)
  returning * into created_item;
  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(target_house, auth.uid(), 'shopping.created', 'Adicionou "' || item_name || '" à lista de compras', jsonb_build_object('item_id', created_item.id, 'priority', item_priority));
  return created_item;
end; $$;

create or replace function public.confirm_shopping_purchase(target_item uuid, final_price numeric)
returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare selected_item public.shopping_items; buyer uuid; member_count integer; member_record record; share numeric;
begin
  select * into selected_item from public.shopping_items where id = target_item for update;
  if selected_item.id is null then raise exception 'Item not found'; end if;
  if not public.can_edit_section(selected_item.house_id, 'shopping') then raise exception 'Permission denied'; end if;
  if selected_item.purchased_at is not null then raise exception 'Item is already purchased'; end if;
  if final_price is null or final_price <= 0 then raise exception 'Final price is required'; end if;
  buyer := auth.uid();
  update public.shopping_items set purchased_price = final_price, purchased_by = buyer, purchased_at = now() where id = target_item returning * into selected_item;
  if selected_item.scope = 'personal' then
    if selected_item.personal_for <> buyer then
      insert into public.member_debts(house_id, debtor_id, creditor_id, amount, source_type, source_id, description)
      values(selected_item.house_id, selected_item.personal_for, buyer, final_price, 'shopping', selected_item.id, selected_item.name);
    end if;
  else
    select count(*) into member_count from public.house_members where house_id = selected_item.house_id;
    share := round(final_price / member_count, 2);
    for member_record in select user_id from public.house_members where house_id = selected_item.house_id and user_id <> buyer loop
      insert into public.member_debts(house_id, debtor_id, creditor_id, amount, source_type, source_id, description)
      values(selected_item.house_id, member_record.user_id, buyer, share, 'shopping', selected_item.id, selected_item.name);
    end loop;
  end if;
  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(selected_item.house_id, buyer, 'shopping.purchased', 'Comprou "' || selected_item.name || '"', jsonb_build_object('item_id', selected_item.id, 'price', final_price));
  return selected_item;
end; $$;

create or replace function public.settle_debt(target_debt uuid) returns public.member_debts
language plpgsql security definer set search_path = public as $$
declare selected_debt public.member_debts;
begin
  select * into selected_debt from public.member_debts where id = target_debt;
  if selected_debt.id is null or (auth.uid() not in (selected_debt.debtor_id, selected_debt.creditor_id) and not public.can_edit_section(selected_debt.house_id, 'finance')) then raise exception 'Permission denied'; end if;
  update public.member_debts set settled_at = now() where id = target_debt returning * into selected_debt;
  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(selected_debt.house_id, auth.uid(), 'debt.settled', 'Marcou uma dívida como liquidada', jsonb_build_object('debt_id', selected_debt.id, 'amount', selected_debt.amount));
  return selected_debt;
end; $$;

grant execute on function public.add_shopping_item(uuid, text, public.shopping_priority, public.shopping_scope, uuid, numeric) to authenticated;
grant execute on function public.confirm_shopping_purchase(uuid, numeric) to authenticated;
grant execute on function public.settle_debt(uuid) to authenticated;

create or replace function public.log_house_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'house_bills' and tg_op = 'INSERT' then
    insert into public.activity_logs(house_id, actor_id, event_type, description) values(new.house_id, new.created_by, 'bill.created', 'Criou a conta "' || new.name || '"');
  elsif tg_table_name = 'house_tasks' and tg_op = 'INSERT' then
    insert into public.activity_logs(house_id, actor_id, event_type, description) values(new.house_id, new.created_by, 'task.created', 'Criou a tarefa "' || new.title || '"');
  elsif tg_table_name = 'house_tasks' and tg_op = 'UPDATE' and old.completed_at is null and new.completed_at is not null then
    insert into public.activity_logs(house_id, actor_id, event_type, description) values(new.house_id, new.completed_by, 'task.completed', 'Concluiu a tarefa "' || new.title || '"');
  elsif tg_table_name = 'house_invites' and tg_op = 'INSERT' then
    insert into public.activity_logs(house_id, actor_id, event_type, description) values(new.house_id, new.created_by, 'invite.created', 'Criou um convite para a casa');
  elsif tg_table_name = 'house_members' and tg_op = 'INSERT' then
    insert into public.activity_logs(house_id, actor_id, event_type, description) values(new.house_id, new.user_id, 'member.joined', 'Entrou na casa');
  elsif tg_table_name = 'house_member_permissions' and tg_op in ('INSERT', 'UPDATE') then
    insert into public.activity_logs(house_id, actor_id, event_type, description) values(new.house_id, new.updated_by, 'permission.updated', 'Atualizou permissões de um membro');
  end if;
  return new;
end; $$;

create trigger log_bill_created after insert on public.house_bills for each row execute procedure public.log_house_activity();
create trigger log_task_activity after insert or update on public.house_tasks for each row execute procedure public.log_house_activity();
create trigger log_invite_created after insert on public.house_invites for each row execute procedure public.log_house_activity();
create trigger log_member_joined after insert on public.house_members for each row execute procedure public.log_house_activity();
create trigger log_permission_updated after insert or update on public.house_member_permissions for each row execute procedure public.log_house_activity();
