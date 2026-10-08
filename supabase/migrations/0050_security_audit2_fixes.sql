-- Jalankan sekali di Supabase SQL Editor (setelah 0049)
-- Fix audit ke-2:
--  1) Gender & tanggal lahir terkunci setelah terisi (cegah bypass filter join Circle+)
--  2) Instagram divalidasi format di DB (hanya saat diisi / diubah)
--  3) Storage: daftar file tidak lagi bisa dibaca anonim (URL publik tetap jalan)
--  4) Laporan & masukan: batas panjang + rate limit (anti-spam)
--
-- DEPLOY KODE (app/profile/data-user, app/onboarding) BERSAMAAN dengan migration ini.
-- Kalau user salah isi gender / tanggal lahir: admin yang mengubah (SQL Editor / halaman admin).

-- ================= 1+2) GUARD PROFIL (versi lengkap dari 0046 + kunci + validasi) =================
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
    new.is_verified := false;
    new.verified_at := null;
    new.energy := 1000;
    new.energy_reset_at := now();

    if coalesce(new.instagram, '') <> '' and new.instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
      raise exception 'Format Instagram tidak valid. Contoh: @username (huruf, angka, titik, underscore).';
    end if;

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
    new.is_verified := old.is_verified;
    new.verified_at := old.verified_at;

    -- gender & tanggal lahir: boleh diisi SEKALI; setelah itu hanya admin yang boleh ubah
    -- (filter join Circle+ bergantung pada dua data ini)
    if nullif(old.gender, '') is not null and new.gender is distinct from old.gender then
      raise exception 'Gender tidak bisa diubah setelah diisi. Hubungi admin kalau salah input.';
    end if;
    if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
      raise exception 'Tanggal lahir tidak bisa diubah setelah diisi. Hubungi admin kalau salah input.';
    end if;
  end if;

  -- format Instagram dicek hanya kalau nilainya berubah (data lama yang belum rapi tidak memblokir update lain)
  if new.instagram is distinct from old.instagram
     and coalesce(new.instagram, '') <> ''
     and new.instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
    raise exception 'Format Instagram tidak valid. Contoh: @username (huruf, angka, titik, underscore).';
  end if;

  -- ganti Instagram -> verifikasi gugur (harus ajukan ulang)
  if old.is_verified
     and lower(trim(coalesce(new.instagram, ''))) is distinct from lower(trim(coalesce(old.instagram, ''))) then
    new.is_verified := false;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

-- ================= 3) STORAGE: TUTUP LIST ANONIM =================
-- Bucket public tetap bisa diakses lewat URL (/object/public/...) TANPA policy select.
-- Policy select tetap diperlukan untuk upsert / remove oleh pemiliknya -> dibatasi ke pemilik / admin.
drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "covers_select_public" on storage.objects;
drop policy if exists "avatar_presets_obj_select" on storage.objects;
drop policy if exists "avatars_select_own_folder" on storage.objects;
drop policy if exists "covers_select_own_or_admin" on storage.objects;
drop policy if exists "avatar_presets_select_admin" on storage.objects;

create policy "avatars_select_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_super_admin_caller())
    )
  );

create policy "covers_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'circle-covers'
    and (owner_id = (select auth.uid())::text or (select public.is_super_admin_caller()))
  );

create policy "avatar_presets_select_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatar-presets' and (select public.is_super_admin_caller()));

-- ================= 4) LAPORAN & MASUKAN: PANJANG + RATE LIMIT =================
-- Trigger saat INSERT saja (baris lama & update admin tidak tersentuh).
-- security definer + auth.uid(): SQL Editor / service role (auth.uid() null) lolos.
create or replace function public.guard_report_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if char_length(coalesce(new.reason, '')) > 200 then
    raise exception 'Alasan laporan terlalu panjang (maks 200 karakter).';
  end if;
  if char_length(coalesce(new.description, '')) > 2000 then
    raise exception 'Deskripsi laporan terlalu panjang (maks 2000 karakter).';
  end if;

  if (select count(*) from public.reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Terlalu banyak laporan, coba lagi nanti.';
  end if;

  if exists (
    select 1 from public.reports
    where reporter_id = new.reporter_id
      and target_type = new.target_type
      and coalesce(target_circle_id, target_user_id) = coalesce(new.target_circle_id, new.target_user_id)
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'Kamu sudah melaporkan ini. Tim kami akan meninjaunya.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_a_guard_report_insert on public.reports;
create trigger trg_a_guard_report_insert
  before insert on public.reports
  for each row execute function public.guard_report_insert();

create or replace function public.guard_feedback_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if char_length(coalesce(new.message, '')) > 2000 then
    raise exception 'Masukan terlalu panjang (maks 2000 karakter).';
  end if;

  if (select count(*) from public.feedback
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Terlalu banyak masukan, coba lagi nanti.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_a_guard_feedback_insert on public.feedback;
create trigger trg_a_guard_feedback_insert
  before insert on public.feedback
  for each row execute function public.guard_feedback_insert();
