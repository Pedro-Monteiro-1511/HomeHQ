create or replace function public.get_my_pending_invites()
returns table(id uuid, code text, expires_at timestamptz, house_id uuid, house_name text)
language sql stable security definer set search_path = public as $$
  select invite.id, invite.code, invite.expires_at, invite.house_id, house.name
  from public.house_invites invite
  join public.houses house on house.id = invite.house_id
  join public.profiles profile on profile.id = auth.uid()
  where invite.type = 'email'
    and invite.recipient_email = profile.email
    and invite.revoked_at is null
    and invite.used_count = 0
    and (invite.expires_at is null or invite.expires_at > now())
    and not exists(
      select 1 from public.house_members
      where house_id = invite.house_id and user_id = auth.uid()
    )
  order by invite.created_at desc;
$$;

create or replace function public.create_house_invite(
  target_house_id uuid,
  invite_kind public.invite_type,
  invite_email text default null,
  invite_max_uses integer default null,
  invite_expires_at timestamptz default null
) returns public.house_invites
language plpgsql security definer set search_path = public as $$
declare created_invite public.house_invites; normalized_email text;
begin
  if not public.can_edit_section(target_house_id, 'members') then raise exception 'Permission denied'; end if;
  normalized_email := lower(trim(invite_email));
  if invite_expires_at is not null and invite_expires_at <= now() then raise exception 'Invite expiration must be in the future'; end if;
  if invite_kind = 'email' and nullif(normalized_email, '') is null then raise exception 'Email invites require an email address'; end if;
  if invite_kind = 'qr' and coalesce(invite_max_uses, 0) < 1 then raise exception 'QR invites require a positive use limit'; end if;
  if invite_kind = 'email' then
    perform pg_advisory_xact_lock(hashtextextended(target_house_id::text || ':' || normalized_email, 0));
  end if;
  if invite_kind = 'email' and exists(
    select 1 from public.house_invites
    where house_id = target_house_id and type = 'email' and recipient_email = normalized_email
      and revoked_at is null and used_count = 0 and (expires_at is null or expires_at > now())
  ) then raise exception 'This user already has an active invite for this house'; end if;
  if invite_kind = 'email' and exists(
    select 1 from public.profiles profile
    join public.house_members member on member.user_id = profile.id
    where profile.email = normalized_email and member.house_id = target_house_id
  ) then raise exception 'This user is already a member of this house'; end if;

  update public.house_invites set revoked_at = now()
  where revoked_at is null and used_count = 0 and expires_at is not null and expires_at <= now();

  insert into public.house_invites(house_id, created_by, type, recipient_email, max_uses, expires_at)
  values(target_house_id, auth.uid(), invite_kind, case when invite_kind = 'email' then normalized_email else null end, case when invite_kind = 'qr' then invite_max_uses else 1 end, invite_expires_at)
  returning * into created_invite;
  return created_invite;
end; $$;

create or replace function public.accept_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare selected_invite public.house_invites; current_email citext; privileged boolean; existing_count integer;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and profile_completed_at is not null) then raise exception 'Complete your profile before accepting an invite'; end if;
  select email, is_privileged into current_email, privileged from public.profiles where id = auth.uid();
  select count(*) into existing_count from public.house_members where user_id = auth.uid();
  if not privileged and existing_count >= 1 then raise exception 'You already belong to a house'; end if;

  select * into selected_invite from public.house_invites
  where code = upper(invite_code) and revoked_at is null and used_count = 0
    and (expires_at is null or expires_at > now()) for update;
  if selected_invite.id is null then raise exception 'Invite is invalid or expired'; end if;
  if selected_invite.type = 'email' and selected_invite.recipient_email <> current_email then raise exception 'This invite belongs to another email address'; end if;
  if selected_invite.max_uses is not null and selected_invite.used_count >= selected_invite.max_uses then raise exception 'Invite use limit reached'; end if;

  insert into public.house_members(house_id, user_id) values(selected_invite.house_id, auth.uid());
  insert into public.invite_uses(invite_id, user_id) values(selected_invite.id, auth.uid());
  update public.house_invites set used_count = used_count + 1 where id = selected_invite.id;
  if selected_invite.type = 'email' then
    update public.house_invites set revoked_at = now()
    where type = 'email' and recipient_email = current_email and id <> selected_invite.id
      and revoked_at is null and used_count = 0;
  end if;
  return selected_invite.house_id;
end; $$;

grant execute on function public.get_my_pending_invites() to authenticated;
