create or replace function public.log_house_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'house_bills' then
    if tg_op = 'INSERT' then
      insert into public.activity_logs(house_id, actor_id, event_type, description)
      values(new.house_id, new.created_by, 'bill.created', 'Criou a conta "' || new.name || '"');
    end if;
  elsif tg_table_name = 'house_tasks' then
    if tg_op = 'INSERT' then
      insert into public.activity_logs(house_id, actor_id, event_type, description)
      values(new.house_id, new.created_by, 'task.created', 'Criou a tarefa "' || new.title || '"');
    elsif tg_op = 'UPDATE' and old.completed_at is null and new.completed_at is not null then
      insert into public.activity_logs(house_id, actor_id, event_type, description)
      values(new.house_id, new.completed_by, 'task.completed', 'Concluiu a tarefa "' || new.title || '"');
    end if;
  elsif tg_table_name = 'house_invites' then
    if tg_op = 'INSERT' then
      insert into public.activity_logs(house_id, actor_id, event_type, description)
      values(new.house_id, new.created_by, 'invite.created', 'Criou um convite para a casa');
    end if;
  elsif tg_table_name = 'house_members' then
    if tg_op = 'INSERT' then
      insert into public.activity_logs(house_id, actor_id, event_type, description)
      values(new.house_id, new.user_id, 'member.joined', 'Entrou na casa');
    end if;
  elsif tg_table_name = 'house_member_permissions' then
    if tg_op in ('INSERT', 'UPDATE') then
      insert into public.activity_logs(house_id, actor_id, event_type, description)
      values(new.house_id, new.updated_by, 'permission.updated', 'Atualizou permissões de um membro');
    end if;
  end if;
  return new;
end; $$;
