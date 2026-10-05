-- Jalankan sekali di Supabase SQL Editor (setelah 0033)
--  A) "Tandai Mulai" untuk host + aturan selesai (menggantikan guard_circle_write dari 0033)
--  B) Batas pendaftaran ditegakkan di DB (tidak bisa dilewati via signInWithOAuth langsung)
--  C) Kuota upload per user + batas ukuran file bucket

-- ================= A) TANDAI MULAI =================
alter table public.circles add column if not exists started_at timestamptz;

create or replace function public.guard_circle_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if not public.is_super_admin_caller() then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.is_circle_plus := old.is_circle_plus; -- biaya energy dipotong saat INSERT

    -- started_at: sekali set, dicap waktu server, maksimal 2 jam sebelum acara
    if new.started_at is distinct from old.started_at then
      if old.started_at is not null or new.started_at is null then
        new.started_at := old.started_at;
      elsif old.status <> 'active' then
        raise exception 'Circle sudah tidak aktif.';
      elsif old.event_date - interval '2 hours' > now() then
        raise exception 'Tandai mulai baru bisa dilakukan maksimal 2 jam sebelum acara.';
      else
        new.started_at := now();
      end if;
    end if;

    -- jadwal tidak boleh dimundurkan ke masa lalu (akal-akal lewati aturan selesai)
    if new.event_date is distinct from old.event_date
       and new.event_date < now() and old.event_date >= now() then
      raise exception 'Tanggal acara tidak boleh di masa lalu.';
    end if;

    -- 'selesai' dari host: hanya setelah acara dimulai (jadwal lewat ATAU sudah ditandai mulai)
    if new.status = 'completed' and old.status is distinct from 'completed'
       and new.event_date > now() and new.started_at is null then
      raise exception 'Tandai mulai dulu sebelum menandai selesai. Pakai Batalkan kalau acara tidak jadi.';
    end if;
  end if;
  return new;
end;
$$;

-- ================= B) BATAS PENDAFTARAN DI DB =================
create or replace function public.enforce_registration_limit()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_enabled text;
  v_limit integer := 0;
begin
  select value into v_enabled from public.app_settings where key = 'registration_limit_enabled';
  begin
    select coalesce(nullif(trim(value), '')::integer, 0) into v_limit
    from public.app_settings where key = 'registration_limit_count';
  exception when others then
    v_limit := 0;
  end;

  if v_enabled = 'true' and coalesce(v_limit, 0) > 0
     and (select count(*) from public.profiles) >= v_limit then
    raise exception 'Pendaftaran ditutup: kuota pengguna sudah penuh.';
  end if;
end;
$$;
revoke all on function public.enforce_registration_limit() from public, anon;
grant execute on function public.enforce_registration_limit() to authenticated;

-- signup baru (Google) -> profil dibuat lewat trigger ini
create or replace function public.handle_new_user()
returns trigger as $$
begin
  perform public.enforce_registration_limit();
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- profil baru lewat client (mis. daftar ulang setelah hapus akun) juga kena batas
create or replace function public.guard_profile_write()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_admin boolean;
  v_snap record;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from public.profiles where id = new.id) then
      return new;
    end if;
    perform public.enforce_registration_limit();
    new.is_super_admin := false;
    new.is_banned := false;
    new.suspended_until := null;
    new.suspension_reason := null;
    new.energy := 1000;
    new.energy_reset_at := now();

    select * into v_snap from public.energy_snapshot_for_me();
    if found then
      new.energy := v_snap.energy;
      new.energy_reset_at := v_snap.energy_reset_at;
    end if;
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

-- ================= C) KUOTA STORAGE =================
create or replace function public.storage_owner_object_count(p_bucket text)
returns bigint
language sql stable security definer set search_path = public, storage
as $$
  select count(*) from storage.objects
  where bucket_id = p_bucket and owner_id = auth.uid()::text;
$$;
revoke all on function public.storage_owner_object_count(text) from public, anon;
grant execute on function public.storage_owner_object_count(text) to authenticated;

-- RESTRICTIVE = digabung AND dengan policy upload yang sudah ada.
-- Cover: maks 100 file per user, avatar: maks 5. Super admin bebas.
drop policy if exists "storage_upload_quota" on storage.objects;
create policy "storage_upload_quota" on storage.objects
  as restrictive for insert to authenticated
  with check (
    public.is_super_admin_caller()
    or (bucket_id = 'circle-covers' and public.storage_owner_object_count('circle-covers') < 100)
    or (bucket_id = 'avatars' and public.storage_owner_object_count('avatars') < 5)
    or bucket_id not in ('circle-covers', 'avatars')
  );

-- klien sudah mengompres (cover <= ~300 KB, avatar ~15 KB) -> turunkan batas
update storage.buckets set file_size_limit = 3145728 where id = 'circle-covers'; -- 3 MB
update storage.buckets set file_size_limit = 1048576 where id = 'avatars';       -- 1 MB
