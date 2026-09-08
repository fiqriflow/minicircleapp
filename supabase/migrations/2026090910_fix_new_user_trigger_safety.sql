-- Jalankan sekali di Supabase SQL Editor
-- FIX: "Database error saving new user"
--
-- Saat user baru signup, auth.users insert -> trigger handle_new_user()
-- insert ke profiles -> itu memicu trigger on_profile_created_log ->
-- log_user_registered() insert ke activity_log. Karena semuanya satu
-- transaksi, kalau LANGKAH LOGGING ini gagal (kolom berubah, RLS berubah,
-- search_path, dll), SEMUA di-rollback -> auth.users pun gagal ke-insert
-- -> Supabase Auth melempar "Database error saving new user", padahal
-- inti masalahnya cuma di logging, bukan di pembuatan akun.
--
-- Solusi: bungkus trigger-trigger logging (bukan trigger utama pembuat
-- profile) dengan EXCEPTION WHEN OTHERS supaya gagal logging cuma
-- dicatat sbg warning, TIDAK menggagalkan signup/aksi utama.

create or replace function public.log_user_registered()
returns trigger as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.id;

  insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
  values ('user_registered', new.id, v_email, new.full_name, new.id, 'User baru mendaftar');

  return new;
exception when others then
  raise warning 'log_user_registered gagal (diabaikan, tidak menggagalkan signup): %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

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
  values ('circle_created', new.created_by, v_email, v_name, new.id, 'Membuat circle "' || new.name || '"');

  return new;
exception when others then
  raise warning 'log_circle_created gagal (diabaikan): %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.log_account_deleted()
returns trigger as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = old.id;

  insert into activity_log (type, actor_id, actor_email, actor_name, target_id, description)
  values ('account_deleted', old.id, v_email, old.full_name, old.id, 'Akun dihapus');

  return old;
exception when others then
  raise warning 'log_account_deleted gagal (diabaikan): %', sqlerrm;
  return old;
end;
$$ language plpgsql security definer;

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
exception when others then
  raise warning 'log_user_suspension_change gagal (diabaikan): %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- FIX tambahan (jaga-jaga): pastikan search_path fungsi utama pembuat
-- profile jelas ke "public", biar gak ada kemungkinan gagal "relation
-- does not exist" kalau search_path role default pernah diubah.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer set search_path = public;
