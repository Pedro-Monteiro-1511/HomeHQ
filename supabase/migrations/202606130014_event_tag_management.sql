alter table public.event_tags add column if not exists is_default boolean not null default false;

insert into public.event_tags(house_id, name, color, created_by, is_default)
select houses.id, 'Geral', '#8b9490', houses.created_by, true
from public.houses
where not exists(select 1 from public.event_tags where event_tags.house_id = houses.id);

update public.event_tags tag
set is_default = true
where tag.id = (
  select candidate.id from public.event_tags candidate
  where candidate.house_id = tag.house_id
  order by candidate.is_default desc, candidate.created_at
  limit 1
)
and not exists(select 1 from public.event_tags existing where existing.house_id = tag.house_id and existing.is_default);

create unique index if not exists one_default_event_tag_per_house on public.event_tags(house_id) where is_default;

create or replace function public.create_default_house_event_tag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_tags(house_id, name, color, created_by, is_default)
  values(new.id, 'Geral', '#8b9490', new.created_by, true);
  return new;
end; $$;

drop trigger if exists create_default_event_tag on public.houses;
create trigger create_default_event_tag after insert on public.houses
for each row execute procedure public.create_default_house_event_tag();

create or replace function public.create_event_tag(target_house uuid, tag_name text, tag_color text)
returns public.event_tags language plpgsql security definer set search_path = public as $$
declare created_tag public.event_tags;
begin
  if not public.can_edit_section(target_house, 'events') then raise exception 'Permission denied'; end if;
  insert into public.event_tags(house_id, name, color, created_by)
  values(target_house, trim(tag_name), tag_color, auth.uid()) returning * into created_tag;
  return created_tag;
end; $$;

create or replace function public.update_event_tag(target_tag uuid, tag_name text, tag_color text)
returns public.event_tags language plpgsql security definer set search_path = public as $$
declare selected_tag public.event_tags;
begin
  select * into selected_tag from public.event_tags where id = target_tag;
  if selected_tag.id is null or not public.can_edit_section(selected_tag.house_id, 'events') then raise exception 'Permission denied'; end if;
  update public.event_tags set name = trim(tag_name), color = tag_color where id = target_tag returning * into selected_tag;
  return selected_tag;
end; $$;

create or replace function public.delete_event_tag(target_tag uuid) returns void
language plpgsql security definer set search_path = public as $$
declare selected_tag public.event_tags; replacement public.event_tags; tag_count integer;
begin
  select * into selected_tag from public.event_tags where id = target_tag;
  if selected_tag.id is null or not public.can_edit_section(selected_tag.house_id, 'events') then raise exception 'Permission denied'; end if;
  select count(*) into tag_count from public.event_tags where house_id = selected_tag.house_id;
  if tag_count <= 1 then raise exception 'A house must always have at least one event tag'; end if;
  select * into replacement from public.event_tags where house_id = selected_tag.house_id and id <> target_tag order by is_default desc, created_at limit 1;
  insert into public.house_event_tag_links(event_id, tag_id)
  select event_id, replacement.id from public.house_event_tag_links where tag_id = target_tag
  on conflict do nothing;
  delete from public.event_tags where id = target_tag;
  if selected_tag.is_default then update public.event_tags set is_default = true where id = replacement.id; end if;
end; $$;

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
  if event_start_date is null or event_end_date is null or event_end_date < event_start_date then raise exception 'Invalid event dates'; end if;
  if event_start_date = event_end_date and event_start_time is not null and event_end_time is not null and event_end_time <= event_start_time then raise exception 'End time must be after start time'; end if;
  insert into public.house_events(house_id, title, description, start_date, end_date, start_time, end_time, created_by)
  values(target_house, trim(event_title), nullif(trim(event_description), ''), event_start_date, event_end_date, event_start_time, event_end_time, auth.uid())
  returning * into created_event;
  select * into selected_tag from public.event_tags where house_id = target_house and id = nullif(tags->0->>'id', '')::uuid;
  if selected_tag.id is null then select * into selected_tag from public.event_tags where house_id = target_house order by is_default desc, created_at limit 1; end if;
  insert into public.house_event_tag_links(event_id, tag_id) values(created_event.id, selected_tag.id);
  insert into public.activity_logs(house_id, actor_id, event_type, description, metadata)
  values(target_house, auth.uid(), 'event.created', 'Criou o evento "' || created_event.title || '"', jsonb_build_object('event_id', created_event.id));
  return created_event;
end; $$;

grant execute on function public.create_event_tag(uuid, text, text) to authenticated;
grant execute on function public.update_event_tag(uuid, text, text) to authenticated;
grant execute on function public.delete_event_tag(uuid) to authenticated;
