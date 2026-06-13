create or replace function public.create_house_invite(
  target_house_id uuid,
  invite_kind public.invite_type,
  invite_email text default null,
  invite_max_uses integer default null,
  invite_expires_at timestamptz default null
) returns public.house_invites
language plpgsql security definer set search_path = public as $$
declare created_invite public.house_invites;
begin
  if not public.can_manage_house(target_house_id) then
    raise exception 'Only house managers can create invites';
  end if;
  if invite_kind = 'email' and nullif(trim(invite_email), '') is null then
    raise exception 'Email invites require an email address';
  end if;
  if invite_kind = 'qr' and coalesce(invite_max_uses, 0) < 1 then
    raise exception 'QR invites require a positive use limit';
  end if;
  insert into public.house_invites(house_id, created_by, type, recipient_email, max_uses, expires_at)
  values (
    target_house_id,
    auth.uid(),
    invite_kind,
    case when invite_kind = 'email' then lower(trim(invite_email)) else null end,
    case when invite_kind = 'qr' then invite_max_uses else 1 end,
    invite_expires_at
  )
  returning * into created_invite;
  return created_invite;
end; $$;

grant execute on function public.create_house_invite(uuid, public.invite_type, text, integer, timestamptz) to authenticated;

create or replace view public.house_member_profiles
with (security_invoker = true) as
select
  hm.house_id,
  hm.user_id,
  hm.role,
  hm.joined_at,
  p.username,
  p.avatar_url,
  p.gender,
  p.created_at as profile_created_at
from public.house_members hm
join public.profiles p on p.id = hm.user_id;

grant select on public.house_member_profiles to authenticated;
