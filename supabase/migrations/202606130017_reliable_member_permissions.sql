create or replace function public.get_house_member_permissions(target_house uuid, target_user uuid)
returns table(section public.permission_section, level public.permission_level)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_section(target_house, 'permissions') then raise exception 'Permission denied'; end if;
  if not exists(select 1 from public.house_members where house_id = target_house and user_id = target_user) then raise exception 'User is not a house member'; end if;
  return query
  select available_section,
    coalesce(configured.level, case when available_section = 'permissions' then 'none'::public.permission_level else 'view'::public.permission_level end)
  from unnest(enum_range(null::public.permission_section)) available_section
  left join public.house_member_permissions configured
    on configured.house_id = target_house and configured.user_id = target_user and configured.section = available_section;
end; $$;

create or replace function public.set_house_permission(
  target_house uuid, target_user uuid, target_section public.permission_section, target_level public.permission_level
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_section(target_house, 'permissions') then raise exception 'Permission denied'; end if;
  if not exists(select 1 from public.house_members where house_id = target_house and user_id = target_user) then raise exception 'User is not a house member'; end if;
  if exists(select 1 from public.house_members where house_id = target_house and user_id = target_user and role = 'owner') then raise exception 'Owner permissions cannot be changed'; end if;
  insert into public.house_member_permissions(house_id, user_id, section, level, updated_by)
  values(target_house, target_user, target_section, target_level, auth.uid())
  on conflict(house_id, user_id, section)
  do update set level = excluded.level, updated_by = auth.uid(), updated_at = now();
end; $$;

grant execute on function public.get_house_member_permissions(uuid, uuid) to authenticated;
grant execute on function public.set_house_permission(uuid, uuid, public.permission_section, public.permission_level) to authenticated;
