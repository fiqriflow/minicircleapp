-- Jalankan sekali di Supabase SQL Editor (setelah 0026)
-- Security hardening: tutup privilege escalation, impersonasi host, kebocoran
-- data ke anon, bypass approval/private circle, dan beberapa policy longgar.
-- Semua guard HANYA berlaku untuk request lewat PostgREST (role "authenticated").
-- SQL Editor (postgres), service role, dan function security definer tidak kena.

-- ================= 0) HELPER =================
create or replace function public.is_super_admin_caller()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_super_admin);
$$;
revoke all on function public.is_super_admin_caller() from public, anon;
grant execute on function public.is_super_admin_caller() to authenticated;

-- Metadata circle yang tetap bisa dibaca walau circle private disembunyikan oleh RLS
create or replace function public.circle_meta(p_circle_id uuid)
returns table(created_by uuid, requires_approval boolean)
language sql stable security definer set search_path = public
as $$
  select c.created_by, coalesce(c.requires_approval, false)
  from public.circles c where c.id = p_circle_id;
$$;
revoke all on function public.circle_meta(uuid) from public, anon;
grant execute on function public.circle_meta(uuid) to authenticated;

-- ================= 1) PROFILES: kolom sensitif =================
-- user biasa TIDAK boleh ubah is_super_admin / ban / suspend / energy.
-- is_super_admin hanya bisa diubah lewat SQL Editor atau service role.
create or replace function public.guard_profile_write()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_admin boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- upsert ke baris yang sudah ada: biar guard UPDATE yang menangani
    if exists (select 1 from public.profiles where id = new.id) then
      return new;
    end if;
    new.is_super_admin := false;
    new.is_banned := false;
    new.suspended_until := null;
    new.suspension_reason := null;
    new.energy := 7;
    new.energy_reset_at := now();
    return new;
  end if;

  v_admin := public.is_super_admin_caller();

  new.is_super_admin := old.is_super_admin;
  if not v_admin then
    new.is_banned := old.is_banned;
    new.suspended_until := old.suspended_until;
    new.suspension_reason := old.suspension_reason;
    new.energy := old.energy;
    new.energy_reset_at := old.energy_reset_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_a_guard_profile_write on public.profiles;
create trigger trg_a_guard_profile_write
  before insert or update on public.profiles
  for each row execute function public.guard_profile_write();

-- user yang lagi di-ban/suspend tidak boleh kabur dengan hapus profil sendiri
create or replace function public.guard_profile_delete()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and not public.is_super_admin_caller()
     and (coalesce(old.is_banned, false)
          or (old.suspended_until is not null and old.suspended_until > now())) then
    raise exception 'Akun sedang dinonaktifkan dan tidak bisa dihapus.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_a_guard_profile_delete on public.profiles;
create trigger trg_a_guard_profile_delete
  before delete on public.profiles
  for each row execute function public.guard_profile_delete();

-- ================= 2) CIRCLES =================
-- insert hanya boleh atas nama diri sendiri (cegah kuras energy / impersonasi host)
drop policy if exists "circles_insert_auth" on public.circles;
drop policy if exists "circles_insert_own" on public.circles;
create policy "circles_insert_own" on public.circles
  for insert to authenticated
  with check (auth.uid() = created_by);

-- circle private cuma kelihatan oleh host, member (termasuk pending), dan admin.
-- Buka lewat link undangan = RPC get_circle_by_invite di bawah.
drop policy if exists "circles_select_all" on public.circles;
drop policy if exists "circles_select_visible" on public.circles;
create policy "circles_select_visible" on public.circles
  for select to authenticated
  using (
    not coalesce(is_private, false)
    or created_by = auth.uid()
    or public.is_super_admin_caller()
    or exists (
      select 1 from public.circle_members m
      where m.circle_id = circles.id and m.user_id = auth.uid()
    )
  );

create or replace function public.get_circle_by_invite(p_code text)
returns setof public.circles
language sql stable security definer set search_path = public
as $$
  select * from public.circles
  where invite_code = upper(trim(p_code))
  limit 1;
$$;
revoke all on function public.get_circle_by_invite(text) from public, anon;
grant execute on function public.get_circle_by_invite(text) to authenticated;

-- ================= 3) DATA PUBLIK -> HANYA USER LOGIN =================
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "members_select_all" on public.circle_members;
drop policy if exists "members_select_authenticated" on public.circle_members;
create policy "members_select_authenticated" on public.circle_members
  for select to authenticated using (true);

-- ================= 4) CIRCLE MEMBERS: cegah bypass approval & edit bebas =================
create or replace function public.guard_circle_member_write()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_host uuid;
  v_approval boolean;
  v_admin boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  select m.created_by, m.requires_approval
    into v_host, v_approval
  from public.circle_meta(new.circle_id) m;

  v_admin := public.is_super_admin_caller();

  if tg_op = 'INSERT' then
    -- circle butuh approval -> semua selain host/admin wajib mulai dari 'pending'
    if v_approval and not v_admin and new.user_id is distinct from v_host then
      new.status := 'pending';
    end if;
    new.checked_in := false;
    new.checked_in_at := null;
    new.energy_penalized := false;
    return new;
  end if;

  -- UPDATE: kolom identitas & penalti tidak boleh diubah lewat client
  new.circle_id := old.circle_id;
  new.user_id := old.user_id;
  new.join_answer := old.join_answer;
  new.joined_at := old.joined_at;
  new.energy_penalized := old.energy_penalized;

  -- hanya host/admin yang boleh ubah status (approve member)
  if not v_admin and v_host is distinct from auth.uid() then
    new.status := old.status;
  end if;
  return new;
end;
$$;

-- nama diawali "trg_a_" biar jalan SEBELUM trg_check_circle_slot
drop trigger if exists trg_a_guard_circle_member on public.circle_members;
create trigger trg_a_guard_circle_member
  before insert or update on public.circle_members
  for each row execute function public.guard_circle_member_write();

-- ================= 5) NOTIFICATIONS =================
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================= 6) STORAGE =================
-- cover hanya bisa ditimpa/dihapus pemilik file atau super admin
drop policy if exists "covers_update_auth" on storage.objects;
drop policy if exists "covers_update_own_or_admin" on storage.objects;
create policy "covers_update_own_or_admin" on storage.objects
  for update
  using (bucket_id = 'circle-covers' and (owner_id = auth.uid()::text or public.is_super_admin_caller()))
  with check (bucket_id = 'circle-covers' and (owner_id = auth.uid()::text or public.is_super_admin_caller()));

drop policy if exists "covers_delete_own_or_admin" on storage.objects;
create policy "covers_delete_own_or_admin" on storage.objects
  for delete
  using (bucket_id = 'circle-covers' and (owner_id = auth.uid()::text or public.is_super_admin_caller()));

-- batas ukuran & tipe file upload
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif']
where id = 'circle-covers';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif']
where id = 'avatars';

-- ================= 7) FUNCTION YANG TIDAK PERLU DIPANGGIL CLIENT =================
-- get_email_by_username membocorkan email user ke anon, dan tidak dipakai app (login = Google)
do $$
begin
  if to_regprocedure('public.get_email_by_username(text)') is not null then
    revoke execute on function public.get_email_by_username(text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.ensure_energy_reset(uuid)') is not null then
    revoke execute on function public.ensure_energy_reset(uuid) from public, anon, authenticated;
  end if;
end $$;

-- kunci search_path semua function security definer (cegah search_path hijack)
do $$
declare
  f text;
  sig regprocedure;
begin
  foreach f in array array[
    'public.notify_new_member()',
    'public.notify_new_comment()',
    'public.mark_completed_circles()',
    'public.notify_circle_cancelled()',
    'public.notify_slot_available()',
    'public.check_circle_slot()',
    'public.log_circle_created()',
    'public.log_user_registered()',
    'public.log_account_deleted()',
    'public.log_user_suspension_change()',
    'public.ensure_energy_reset(uuid)',
    'public.check_and_deduct_energy()',
    'public.get_my_energy()',
    'public.penalize_no_show()',
    'public.host_set_checkin(uuid, boolean)'
  ]
  loop
    sig := to_regprocedure(f);
    if sig is not null then
      execute format('alter function %s set search_path = public, auth, pg_temp', sig);
    end if;
  end loop;
end $$;

-- ================= 8) ANTI-SPAM KOMENTAR =================
alter table public.circle_comments drop constraint if exists circle_comments_message_len;
alter table public.circle_comments
  add constraint circle_comments_message_len
  check (char_length(message) between 1 and 2000) not valid;

create or replace function public.rate_limit_comments()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and (select count(*) from public.circle_comments
          where user_id = new.user_id and created_at > now() - interval '30 seconds') >= 10 then
    raise exception 'Terlalu banyak komentar, coba lagi sebentar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_a_rate_limit_comments on public.circle_comments;
create trigger trg_a_rate_limit_comments
  before insert on public.circle_comments
  for each row execute function public.rate_limit_comments();
