create policy "Recipients can view email invites" on public.house_invites for select to authenticated
using (
  type = 'email'
  and recipient_email = (select email from public.profiles where id = auth.uid())
  and revoked_at is null
  and used_count = 0
  and (expires_at is null or expires_at > now())
);

create policy "Invite recipients can view invited house" on public.houses for select to authenticated
using (
  exists (
    select 1 from public.house_invites
    where house_id = houses.id
      and type = 'email'
      and recipient_email = (select email from public.profiles where id = auth.uid())
      and revoked_at is null
      and used_count = 0
      and (expires_at is null or expires_at > now())
  )
);

create or replace function public.reject_invite(invite_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.house_invites
  set revoked_at = now()
  where code = upper(invite_code)
    and type = 'email'
    and recipient_email = (select email from public.profiles where id = auth.uid())
    and revoked_at is null;
  if not found then raise exception 'Invite is invalid or does not belong to this user'; end if;
end; $$;

grant execute on function public.reject_invite(text) to authenticated;
