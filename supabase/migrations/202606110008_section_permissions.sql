create type public.permission_section as enum ('dashboard', 'bills', 'tasks', 'members', 'permissions');
create type public.permission_level as enum ('none', 'view', 'edit');

create table public.house_member_permissions (
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  section public.permission_section not null,
  level public.permission_level not null default 'view',
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (house_id, user_id, section)
);

alter table public.house_member_permissions enable row level security;

create or replace function public.house_permission_level(target_house uuid, target_section public.permission_section)
returns public.permission_level language plpgsql stable security definer set search_path = public as $$
declare member_role public.house_role; configured_level public.permission_level;
begin
  select role into member_role from public.house_members where house_id = target_house and user_id = auth.uid();
  if member_role is null then return 'none'; end if;
  if member_role = 'owner' then return 'edit'; end if;
  select level into configured_level from public.house_member_permissions
  where house_id = target_house and user_id = auth.uid() and section = target_section;
  if configured_level is not null then return configured_level; end if;
  if target_section = 'permissions' then return 'none'; end if;
  return 'view';
end; $$;

create or replace function public.can_view_section(target_house uuid, target_section public.permission_section)
returns boolean language sql stable security definer set search_path = public as $$
  select public.house_permission_level(target_house, target_section) in ('view', 'edit');
$$;

create or replace function public.can_edit_section(target_house uuid, target_section public.permission_section)
returns boolean language sql stable security definer set search_path = public as $$
  select public.house_permission_level(target_house, target_section) = 'edit';
$$;

create or replace function public.set_house_permission(
  target_house uuid, target_user uuid, target_section public.permission_section, target_level public.permission_level
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_section(target_house, 'permissions') then raise exception 'Permission denied'; end if;
  if not exists(select 1 from public.house_members where house_id = target_house and user_id = target_user) then raise exception 'User is not a house member'; end if;
  if exists(select 1 from public.house_members where house_id = target_house and user_id = target_user and role = 'owner') then raise exception 'Owner permissions cannot be changed'; end if;
  insert into public.house_member_permissions(house_id, user_id, section, level, updated_by)
  values(target_house, target_user, target_section, target_level, auth.uid())
  on conflict(house_id, user_id, section) do update set level = excluded.level, updated_by = auth.uid(), updated_at = now();
end; $$;

create or replace function public.get_my_house_permissions(target_house uuid)
returns table(section public.permission_section, level public.permission_level)
language sql stable security definer set search_path = public as $$
  select section, public.house_permission_level(target_house, section)
  from unnest(enum_range(null::public.permission_section)) section;
$$;

create policy "Permission managers can view permissions" on public.house_member_permissions for select to authenticated
using (public.can_edit_section(house_id, 'permissions'));

grant execute on function public.get_my_house_permissions(uuid) to authenticated;
grant execute on function public.set_house_permission(uuid, uuid, public.permission_section, public.permission_level) to authenticated;

create or replace function public.create_house_bill(
  target_house_id uuid, bill_name text, bill_amount numeric, bill_frequency public.bill_frequency,
  bill_next_due_date date, shares jsonb
) returns public.house_bills language plpgsql security definer set search_path = public as $$
declare created_bill public.house_bills; share_total numeric; share_item jsonb; share_user uuid;
begin
  if not public.can_edit_section(target_house_id, 'bills') then raise exception 'Permission denied'; end if;
  if bill_next_due_date is null then raise exception 'A payment date is required'; end if;
  select coalesce(sum((item->>'amount')::numeric), 0) into share_total from jsonb_array_elements(shares) item;
  if round(share_total, 2) <> round(bill_amount, 2) then raise exception 'Bill shares must equal the bill amount'; end if;
  insert into public.house_bills(house_id, name, amount, frequency, next_due_date, due_day, created_by)
  values(target_house_id, bill_name, bill_amount, bill_frequency, bill_next_due_date, extract(day from bill_next_due_date), auth.uid()) returning * into created_bill;
  for share_item in select * from jsonb_array_elements(shares) loop
    share_user := (share_item->>'user_id')::uuid;
    if not exists(select 1 from public.house_members where house_id = target_house_id and user_id = share_user) then raise exception 'Every bill share must belong to a house member'; end if;
    insert into public.house_bill_shares(bill_id, user_id, amount) values(created_bill.id, share_user, round((share_item->>'amount')::numeric, 2));
  end loop;
  return created_bill;
end; $$;

create or replace function public.create_house_task(
  target_house_id uuid, task_title text, task_description text,
  task_frequency public.task_frequency, task_next_due_at timestamptz, assignee_ids uuid[]
) returns public.house_tasks language plpgsql security definer set search_path = public as $$
declare created_task public.house_tasks; assignee uuid;
begin
  if not public.can_edit_section(target_house_id, 'tasks') then raise exception 'Permission denied'; end if;
  if coalesce(array_length(assignee_ids, 1), 0) = 0 then raise exception 'Choose at least one assignee'; end if;
  insert into public.house_tasks(house_id, title, description, frequency, next_due_at, created_by)
  values(target_house_id, task_title, task_description, task_frequency, task_next_due_at, auth.uid()) returning * into created_task;
  foreach assignee in array assignee_ids loop
    if not exists(select 1 from public.house_members where house_id = target_house_id and user_id = assignee) then raise exception 'Every assignee must be a house member'; end if;
    insert into public.house_task_assignees(task_id, user_id) values(created_task.id, assignee);
  end loop;
  return created_task;
end; $$;

create or replace function public.complete_house_task(target_task_id uuid) returns public.house_tasks
language plpgsql security definer set search_path = public as $$
declare selected_task public.house_tasks;
begin
  select * into selected_task from public.house_tasks where id = target_task_id;
  if not public.can_edit_section(selected_task.house_id, 'tasks') then raise exception 'Permission denied'; end if;
  update public.house_tasks set completed_at = now(), completed_by = auth.uid(), updated_at = now() where id = target_task_id returning * into selected_task;
  return selected_task;
end; $$;

create or replace function public.create_house_invite(
  target_house_id uuid, invite_kind public.invite_type, invite_email text default null,
  invite_max_uses integer default null, invite_expires_at timestamptz default null
) returns public.house_invites language plpgsql security definer set search_path = public as $$
declare created_invite public.house_invites;
begin
  if not public.can_edit_section(target_house_id, 'members') then raise exception 'Permission denied'; end if;
  if invite_kind = 'email' and nullif(trim(invite_email), '') is null then raise exception 'Email invites require an email address'; end if;
  if invite_kind = 'qr' and coalesce(invite_max_uses, 0) < 1 then raise exception 'QR invites require a positive use limit'; end if;
  insert into public.house_invites(house_id, created_by, type, recipient_email, max_uses, expires_at)
  values(target_house_id, auth.uid(), invite_kind, case when invite_kind = 'email' then lower(trim(invite_email)) else null end, case when invite_kind = 'qr' then invite_max_uses else 1 end, invite_expires_at)
  returning * into created_invite;
  return created_invite;
end; $$;

drop policy if exists "Members can view house bills" on public.house_bills;
create policy "Section viewers can view house bills" on public.house_bills for select to authenticated using (public.can_view_section(house_id, 'bills'));
drop policy if exists "Members can view bill shares" on public.house_bill_shares;
create policy "Section viewers can view bill shares" on public.house_bill_shares for select to authenticated using (exists(select 1 from public.house_bills where id = bill_id and public.can_view_section(house_id, 'bills')));
drop policy if exists "Members can view tasks" on public.house_tasks;
create policy "Section viewers can view tasks" on public.house_tasks for select to authenticated using (public.can_view_section(house_id, 'tasks'));
drop policy if exists "Members can view task assignees" on public.house_task_assignees;
create policy "Section viewers can view task assignees" on public.house_task_assignees for select to authenticated using (exists(select 1 from public.house_tasks where id = task_id and public.can_view_section(house_id, 'tasks')));
drop policy if exists "Members can view memberships" on public.house_members;
create policy "Section users can view memberships" on public.house_members for select to authenticated using (
  public.can_view_section(house_id, 'members')
  or public.can_edit_section(house_id, 'bills')
  or public.can_edit_section(house_id, 'tasks')
  or public.can_edit_section(house_id, 'permissions')
);
drop policy if exists "Managers can view invites" on public.house_invites;
create policy "Member editors can view invites" on public.house_invites for select to authenticated
using (public.can_edit_section(house_id, 'members'));
drop policy if exists "Managers can update invites" on public.house_invites;
create policy "Member editors can update invites" on public.house_invites for update to authenticated
using (public.can_edit_section(house_id, 'members'));
