create type public.task_frequency as enum ('one_time', 'daily', 'weekly', 'monthly');

create table public.house_tasks (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  frequency public.task_frequency not null,
  next_due_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.house_task_assignees (
  task_id uuid not null references public.house_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.house_task_notification_preferences (
  task_id uuid not null references public.house_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notify_on_completion boolean not null default false,
  primary key (task_id, user_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.house_tasks enable row level security;
alter table public.house_task_assignees enable row level security;
alter table public.house_task_notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Members can view tasks" on public.house_tasks for select to authenticated using (public.is_house_member(house_id));
create policy "Members can view task assignees" on public.house_task_assignees for select to authenticated using (exists(select 1 from public.house_tasks where id = task_id and public.is_house_member(house_id)));
create policy "Users can view task preferences" on public.house_task_notification_preferences for select to authenticated using (user_id = auth.uid());
create policy "Users can create task preferences" on public.house_task_notification_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update task preferences" on public.house_task_notification_preferences for update to authenticated using (user_id = auth.uid());
create policy "Users manage own push subscriptions" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_house_task(
  target_house_id uuid, task_title text, task_description text,
  task_frequency public.task_frequency, task_next_due_at timestamptz, assignee_ids uuid[]
) returns public.house_tasks language plpgsql security definer set search_path = public as $$
declare created_task public.house_tasks; assignee uuid;
begin
  if not public.is_house_member(target_house_id) then raise exception 'Only house members can create tasks'; end if;
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
  if not public.is_house_member(selected_task.house_id) then raise exception 'Only house members can complete tasks'; end if;
  update public.house_tasks set completed_at = now(), completed_by = auth.uid(), updated_at = now() where id = target_task_id returning * into selected_task;
  return selected_task;
end; $$;

grant execute on function public.create_house_task(uuid, text, text, public.task_frequency, timestamptz, uuid[]) to authenticated;
grant execute on function public.complete_house_task(uuid) to authenticated;
