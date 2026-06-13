alter table public.houses
  add column if not exists currency char(3) not null default 'EUR',
  add column if not exists timezone text not null default 'Europe/Lisbon',
  add column if not exists updated_at timestamptz not null default now();

drop function if exists public.create_house(text);

create or replace function public.create_house(
  house_name text,
  house_currency text default 'EUR',
  house_timezone text default 'Europe/Lisbon'
) returns public.houses
language plpgsql security definer set search_path = public as $$
declare created_house public.houses;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and profile_completed_at is not null) then
    raise exception 'Complete your profile before creating a house';
  end if;
  insert into public.houses(name, currency, timezone, created_by)
  values (house_name, upper(house_currency), house_timezone, auth.uid())
  returning * into created_house;
  insert into public.house_members(house_id, user_id, role)
  values (created_house.id, auth.uid(), 'owner');
  return created_house;
end; $$;

grant execute on function public.create_house(text, text, text) to authenticated;
