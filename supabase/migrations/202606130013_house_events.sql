create table public.event_tags (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  color text not null default '#4382df' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (house_id, name)
);

create table public.house_events (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (start_date <> end_date or end_time is null or start_time is null or end_time > start_time)
);

create table public.house_event_tag_links (
  event_id uuid not null references public.house_events(id) on delete cascade,
  tag_id uuid not null references public.event_tags(id) on delete cascade,
  primary key (event_id, tag_id)
);

create index house_events_upcoming_idx on public.house_events(house_id, start_date, end_date);

alter table public.event_tags enable row level security;
alter table public.house_events enable row level security;
alter table public.house_event_tag_links enable row level security;

create policy "Event viewers can view tags" on public.event_tags for select to authenticated
using (public.can_view_section(house_id, 'events'));

create policy "Event viewers can view events" on public.house_events for select to authenticated
using (public.can_view_section(house_id, 'events'));

create policy "Event viewers can view event tags" on public.house_event_tag_links for select to authenticated
using (exists(select 1 from public.house_events where id = event_id and public.can_view_section(house_id, 'events')));

create or replace function public.create_house_event(
  target_house uuid,
  event_title text,
  event_description text,
  event_start_date date,
  event_end_date date,
  event_start_time time default null,
  event_end_time time default null,
  tags jsonb default '[]'::jsonb
) returns public.house_events language plpgsql security definer set search_path = public as $$
declare created_event public.house_events; tag_item jsonb; selected_tag public.event_tags;
begin
  if not public.can_edit_section(target_house, 'events') then raise exception 'Permission denied'; end if;
  if event_start_date is null or event_end_date is null then raise exception 'Start and end dates are required'; end if;
  if event_end_date < event_start_date then raise exception 'End date cannot be before start date'; end if;
  if event_start_date = event_end_date and event_start_time is not null and event_end_time is not null and event_end_time <= event_start_time then raise exception 'End time must be after start time'; end if;

  insert into public.house_events(house_id, title, description, start_date, end_date, start_time, end_time, created_by)
  values(target_house, trim(event_title), nullif(trim(event_description), ''), event_start_date, event_end_date, event_start_time, event_end_time, auth.uid())
  returning * into created_event;

  for tag_item in select * from jsonb_array_elements(tags) loop
    insert into public.event_tags(house_id, name, color, created_by)
    values(target_house, trim(tag_item->>'name'), coalesce(nullif(tag_item->>'color', ''), '#4382df'), auth.uid())
    on conflict(house_id, name) do update set color = excluded.color
    returning * into selected_tag;
    insert into public.house_event_tag_links(event_id, tag_id) values(created_event.id, selected_tag.id) on conflict do nothing;
  end loop;

  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(target_house, auth.uid(), 'event.created', 'Criou o evento "' || created_event.title || '"', jsonb_build_object('event_id', created_event.id));
  return created_event;
end; $$;

grant execute on function public.create_house_event(uuid, text, text, date, date, time, time, jsonb) to authenticated;
