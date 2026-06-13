create table public.debt_adjustments (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  participant_ids uuid[] not null,
  original_debts jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.debt_adjustments enable row level security;
create policy "Finance viewers can view adjustments" on public.debt_adjustments for select to authenticated
using (public.can_view_section(house_id, 'finance'));

create or replace function public.create_general_debt_adjustment(target_house uuid, selected_users uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  adjustment_id uuid;
  original_items jsonb;
  debtor_record record;
  creditor_record record;
  transfer_amount numeric;
begin
  if not public.can_edit_section(target_house, 'finance') then raise exception 'Permission denied'; end if;
  if coalesce(array_length(selected_users, 1), 0) < 2 then raise exception 'Choose at least two members'; end if;
  if exists(select 1 from unnest(selected_users) selected_user where not exists(select 1 from public.house_members where house_id = target_house and user_id = selected_user)) then raise exception 'Every selected user must be a house member'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'debtor_id', debtor_id, 'creditor_id', creditor_id,
    'amount', amount, 'description', description, 'source_type', source_type, 'source_id', source_id
  ) order by created_at), '[]'::jsonb) into original_items
  from public.member_debts
  where house_id = target_house and settled_at is null
    and debtor_id = any(selected_users) and creditor_id = any(selected_users);

  if jsonb_array_length(original_items) = 0 then raise exception 'There are no internal debts to adjust'; end if;

  insert into public.debt_adjustments(house_id, created_by, participant_ids, original_debts)
  values(target_house, auth.uid(), selected_users, original_items) returning id into adjustment_id;

  create temporary table adjustment_balances(user_id uuid primary key, balance numeric(14,2) not null) on commit drop;
  insert into adjustment_balances(user_id, balance)
  select participant, coalesce(sum(case when debt.creditor_id = participant then debt.amount else -debt.amount end), 0)
  from unnest(selected_users) participant
  left join public.member_debts debt on debt.house_id = target_house and debt.settled_at is null
    and debt.debtor_id = any(selected_users) and debt.creditor_id = any(selected_users)
    and participant in (debt.debtor_id, debt.creditor_id)
  group by participant;

  update public.member_debts set settled_at = now()
  where house_id = target_house and settled_at is null
    and debtor_id = any(selected_users) and creditor_id = any(selected_users);

  loop
    select user_id, balance into debtor_record from adjustment_balances where balance < -0.004 order by balance limit 1;
    exit when not found;
    select user_id, balance into creditor_record from adjustment_balances where balance > 0.004 order by balance desc limit 1;
    exit when not found;
    transfer_amount := round(least(-debtor_record.balance, creditor_record.balance), 2);
    insert into public.member_debts(house_id, debtor_id, creditor_id, amount, source_type, source_id, description)
    values(target_house, debtor_record.user_id, creditor_record.user_id, transfer_amount, 'general_adjustment', adjustment_id, 'Ajuste geral');
    update adjustment_balances set balance = balance + transfer_amount where user_id = debtor_record.user_id;
    update adjustment_balances set balance = balance - transfer_amount where user_id = creditor_record.user_id;
  end loop;

  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(target_house, auth.uid(), 'debt.general_adjustment', 'Fez um ajuste geral entre ' || array_length(selected_users, 1) || ' membros', jsonb_build_object('adjustment_id', adjustment_id, 'participants', selected_users, 'original_debts', original_items));
  return adjustment_id;
end; $$;

grant execute on function public.create_general_debt_adjustment(uuid, uuid[]) to authenticated;
