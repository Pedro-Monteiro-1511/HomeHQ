create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.gender_type as enum ('female', 'male', 'non_binary', 'prefer_not_to_say');
create type public.house_role as enum ('owner', 'admin', 'member');
create type public.invite_type as enum ('email', 'qr');
create type public.request_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  username citext unique,
  gender public.gender_type,
  avatar_url text,
  is_privileged boolean not null default false,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_length check (username is null or char_length(username) between 3 and 30)
);

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
  currency char(3) not null default 'EUR',
  timezone text not null default 'Europe/Lisbon',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint currency_iso_code check (currency = upper(currency))
);

create table public.house_members (
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.house_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (house_id, user_id)
);

create table public.house_invites (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  type public.invite_type not null,
  code text not null unique default upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 16)),
  recipient_email citext,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_invite_has_recipient check (type <> 'email' or recipient_email is not null),
  constraint qr_invite_has_limit check (type <> 'qr' or (max_uses is not null and max_uses > 0)),
  constraint valid_use_count check (used_count >= 0 and (max_uses is null or used_count <= max_uses))
);

create table public.invite_uses (
  invite_id uuid not null references public.house_invites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.protect_profile_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and new.is_privileged is distinct from old.is_privileged then
    raise exception 'Users cannot change their privileged status';
  end if;
  new.email := old.email;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.username is not null and new.gender is not null and new.profile_completed_at is null then new.profile_completed_at := now(); end if;
  return new;
end; $$;

create trigger protect_profile_fields_before_update before update on public.profiles
for each row execute procedure public.protect_profile_fields();

create or replace function public.is_house_member(target_house uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.house_members where house_id = target_house and user_id = auth.uid());
$$;

create or replace function public.can_manage_house(target_house uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.house_members where house_id = target_house and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.enforce_house_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare privileged boolean; existing_count integer; approved_request boolean;
begin
  select is_privileged into privileged from public.profiles where id = new.user_id;
  select count(*) into existing_count from public.house_members where user_id = new.user_id;
  select exists(select 1 from public.membership_requests where house_id = new.house_id and user_id = new.user_id and status = 'approved') into approved_request;
  if not privileged and existing_count >= 1 and not approved_request then
    raise exception 'House limit reached. An approved membership request is required.';
  end if;
  return new;
end; $$;

create trigger enforce_house_limit_before_insert before insert on public.house_members
for each row execute procedure public.enforce_house_limit();

create or replace function public.create_house(house_name text, house_currency text default 'EUR', house_timezone text default 'Europe/Lisbon') returns public.houses
language plpgsql security definer set search_path = public as $$
declare created_house public.houses;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and profile_completed_at is not null) then raise exception 'Complete your profile before creating a house'; end if;
  insert into public.houses(name, currency, timezone, created_by) values (house_name, upper(house_currency), house_timezone, auth.uid()) returning * into created_house;
  insert into public.house_members(house_id, user_id, role) values (created_house.id, auth.uid(), 'owner');
  return created_house;
end; $$;

create or replace function public.accept_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare selected_invite public.house_invites; current_email citext;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and profile_completed_at is not null) then raise exception 'Complete your profile before accepting an invite'; end if;
  select * into selected_invite from public.house_invites where code = upper(invite_code) and revoked_at is null and (expires_at is null or expires_at > now()) for update;
  if selected_invite.id is null then raise exception 'Invite is invalid or expired'; end if;
  select email into current_email from public.profiles where id = auth.uid();
  if selected_invite.type = 'email' and selected_invite.recipient_email <> current_email then raise exception 'This invite belongs to another email address'; end if;
  if selected_invite.max_uses is not null and selected_invite.used_count >= selected_invite.max_uses then raise exception 'Invite use limit reached'; end if;
  insert into public.house_members(house_id, user_id) values (selected_invite.house_id, auth.uid());
  insert into public.invite_uses(invite_id, user_id) values (selected_invite.id, auth.uid());
  update public.house_invites set used_count = used_count + 1 where id = selected_invite.id;
  return selected_invite.house_id;
end; $$;

alter table public.profiles enable row level security;
alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.membership_requests enable row level security;
alter table public.house_invites enable row level security;
alter table public.invite_uses enable row level security;

create policy "Users can view own private profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Members can view houses" on public.houses for select to authenticated using (public.is_house_member(id));
create policy "Members can view memberships" on public.house_members for select to authenticated using (public.is_house_member(house_id));
create policy "Users can create requests" on public.membership_requests for insert to authenticated with check (user_id = auth.uid());
create policy "Users and managers can view requests" on public.membership_requests for select to authenticated using (user_id = auth.uid() or public.can_manage_house(house_id));
create policy "Managers can update requests" on public.membership_requests for update to authenticated using (public.can_manage_house(house_id));
create policy "Managers can create invites" on public.house_invites for insert to authenticated with check (created_by = auth.uid() and public.can_manage_house(house_id));
create policy "Managers can view invites" on public.house_invites for select to authenticated using (public.can_manage_house(house_id));
create policy "Managers can update invites" on public.house_invites for update to authenticated using (public.can_manage_house(house_id));
create policy "Managers can view invite uses" on public.invite_uses for select to authenticated using (exists(select 1 from public.house_invites where id = invite_id and public.can_manage_house(house_id)));

create view public.public_profiles as
select id, username, gender, avatar_url, profile_completed_at, created_at
from public.profiles
where profile_completed_at is not null;

grant select on public.public_profiles to authenticated;
grant execute on function public.create_house(text, text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "Avatar images are public" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own avatar" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
