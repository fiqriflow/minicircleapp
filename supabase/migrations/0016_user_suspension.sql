-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Admin bisa nonaktifkan user sementara (suspend) atau permanen (banned)

alter table profiles add column if not exists suspended_until timestamptz;
alter table profiles add column if not exists is_banned boolean default false;
alter table profiles add column if not exists suspension_reason text;

-- Log otomatis tiap kali status suspend/ban berubah
create or replace function public.log_user_suspension_change()
returns trigger as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.id;

  if new.is_banned = true and coalesce(old.is_banned, false) = false then
    insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
    values ('user_banned', new.id, v_email, new.full_name, new.id, 'Akun dinonaktifkan permanen');

  elsif new.is_banned = false
        and new.suspended_until is not null
        and new.suspended_until is distinct from old.suspended_until then
    insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
    values (
      'user_suspended', new.id, v_email, new.full_name, new.id,
      'Akun dinonaktifkan sementara sampai ' || to_char(new.suspended_until, 'DD Mon YYYY HH24:MI')
    );

  elsif new.is_banned = false
        and new.suspended_until is null
        and (coalesce(old.is_banned, false) = true or old.suspended_until is not null) then
    insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
    values ('user_reactivated', new.id, v_email, new.full_name, new.id, 'Akun diaktifkan kembali');
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_suspension_change_log on profiles;
create trigger on_profile_suspension_change_log
  after update of is_banned, suspended_until on profiles
  for each row execute procedure public.log_user_suspension_change();
