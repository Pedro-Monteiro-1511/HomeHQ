alter table public.houses
  add column if not exists appearance_preset text not null default 'light'
  check (appearance_preset in ('light', 'dark', 'ocean'));

create table public.shopping_purchase_shares (
  item_id uuid not null references public.shopping_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  primary key (item_id, user_id)
);

alter table public.shopping_purchase_shares enable row level security;
create policy "Shopping viewers can view purchase shares" on public.shopping_purchase_shares for select to authenticated
using (exists(select 1 from public.shopping_items where id = item_id and public.can_view_section(house_id, 'shopping')));

create or replace function public.set_house_appearance(target_house uuid, preset text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_house(target_house) then raise exception 'Only house managers can change house settings'; end if;
  if preset not in ('light', 'dark', 'ocean') then raise exception 'Invalid appearance preset'; end if;
  update public.houses set appearance_preset = preset, updated_at = now() where id = target_house;
end; $$;

drop function if exists public.confirm_shopping_purchase(uuid, numeric);
create or replace function public.confirm_shopping_purchase(
  target_item uuid, final_price numeric, buyer_id uuid, shares jsonb
) returns public.shopping_items language plpgsql security definer set search_path = public as $$
declare selected_item public.shopping_items; share_item jsonb; share_user uuid; share_amount numeric; share_total numeric;
begin
  select * into selected_item from public.shopping_items where id = target_item for update;
  if selected_item.id is null then raise exception 'Item not found'; end if;
  if not public.can_edit_section(selected_item.house_id, 'shopping') then raise exception 'Permission denied'; end if;
  if selected_item.purchased_at is not null then raise exception 'Item is already purchased'; end if;
  if final_price is null or final_price <= 0 then raise exception 'Final price is required'; end if;
  if not exists(select 1 from public.house_members where house_id = selected_item.house_id and user_id = buyer_id) then raise exception 'Buyer must be a house member'; end if;
  select coalesce(sum((item->>'amount')::numeric), 0) into share_total from jsonb_array_elements(shares) item;
  if round(share_total, 2) <> round(final_price, 2) then raise exception 'Purchase shares must equal the final price'; end if;

  update public.shopping_items set purchased_price = final_price, purchased_by = buyer_id, purchased_at = now()
  where id = target_item returning * into selected_item;

  for share_item in select * from jsonb_array_elements(shares) loop
    share_user := (share_item->>'user_id')::uuid;
    share_amount := round((share_item->>'amount')::numeric, 2);
    if not exists(select 1 from public.house_members where house_id = selected_item.house_id and user_id = share_user) then raise exception 'Every share must belong to a house member'; end if;
    insert into public.shopping_purchase_shares(item_id, user_id, amount) values(selected_item.id, share_user, share_amount);
    if share_user <> buyer_id and share_amount > 0 then
      insert into public.member_debts(house_id, debtor_id, creditor_id, amount, source_type, source_id, description)
      values(selected_item.house_id, share_user, buyer_id, share_amount, 'shopping', selected_item.id, selected_item.name);
    end if;
  end loop;

  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(selected_item.house_id, auth.uid(), 'shopping.purchased', 'Registou a compra "' || selected_item.name || '"', jsonb_build_object('item_id', selected_item.id, 'price', final_price, 'buyer_id', buyer_id));
  return selected_item;
end; $$;

create or replace function public.complete_house_task(target_task_id uuid) returns public.house_tasks
language plpgsql security definer set search_path = public as $$
declare selected_task public.house_tasks;
begin
  select * into selected_task from public.house_tasks where id = target_task_id;
  if not public.can_view_section(selected_task.house_id, 'tasks') then raise exception 'Permission denied'; end if;
  update public.house_tasks set completed_at = now(), completed_by = auth.uid(), updated_at = now()
  where id = target_task_id returning * into selected_task;
  return selected_task;
end; $$;

grant execute on function public.set_house_appearance(uuid, text) to authenticated;
grant execute on function public.confirm_shopping_purchase(uuid, numeric, uuid, jsonb) to authenticated;
