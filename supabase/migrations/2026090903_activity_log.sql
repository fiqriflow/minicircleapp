-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Log History untuk Super Admin (circle dibuat, user baru daftar, akun dihapus)

-- 1) Tabel log
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,              -- 'circle_created' | 'user_registered' | 'account_deleted'
  actor_id uuid,                   -- id user terkait (tidak pakai FK, biar log tetap ada walau user sudah dihapus)
  actor_email text,
  actor_name text,
  target_id uuid,
  description text,
  created_at timestamptz default now()
);

alter table activity_log enable row level security;

drop policy if exists "activity_log_select_admin" on activity_log;
create policy "activity_log_select_admin" on activity_log for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);

drop policy if exists "activity_log_delete_admin" on activity_log;
create policy "activity_log_delete_admin" on activity_log for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);
-- Sengaja tidak ada policy insert/update untuk role biasa; insert hanya lewat
-- trigger function di bawah (security definer), bukan lewat client langsung.

-- 2) Trigger: circle baru dibuat
create or replace function public.log_circle_created()
returns trigger as $$
declare
  v_email text;
  v_name text;
begin
  select u.email, p.full_name into v_email, v_name
  from profiles p
  join auth.users u on u.id = p.id
  where p.id = new.created_by;

  insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
  values (
    'circle_created',
    new.created_by,
    v_email,
    v_name,
    new.id,
    'Membuat circle "' || new.name || '"'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_circle_created_log on circles;
create trigger on_circle_created_log
  after insert on circles
  for each row execute procedure public.log_circle_created();

-- 3) Trigger: user baru daftar (profile baru dibuat)
create or replace function public.log_user_registered()
returns trigger as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.id;

  insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
  values (
    'user_registered',
    new.id,
    v_email,
    new.full_name,
    new.id,
    'User baru mendaftar'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created_log on profiles;
create trigger on_profile_created_log
  after insert on profiles
  for each row execute procedure public.log_user_registered();

-- 4) Trigger: akun dihapus (baris profiles terhapus, baik self-delete atau admin-delete)
create or replace function public.log_account_deleted()
returns trigger as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = old.id;

  insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
  values (
    'account_deleted',
    old.id,
    v_email,
    old.full_name,
    old.id,
    'Akun dihapus'
  );
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_deleted_log on profiles;
create trigger on_profile_deleted_log
  before delete on profiles
  for each row execute procedure public.log_account_deleted();
