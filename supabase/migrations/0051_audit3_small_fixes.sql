-- Jalankan sekali di Supabase SQL Editor (setelah 0050)
--  1) avatar_url hanya boleh URL storage project sendiri (cek hanya saat nilainya berubah)
--  2) Batas panjang kolom teks profil & circle (trigger, hanya saat insert / nilai berubah)
--  3) Instagram dinormalisasi (selalu diawali @) + unique index verified tidak peka '@'
--  4) Fungsi daftar file circle-covers milik user (dipakai hard-delete user)
--
-- !! WAJIB: ganti REF di v_base di bawah dengan project ref Supabase kamu
--    (sama dengan NEXT_PUBLIC_SUPABASE_URL, tanpa slash akhir). Kalau belum diganti, migration berhenti.

-- ================= 0) BASE URL STORAGE =================
create or replace function public.app_storage_public_base()
returns text
language sql immutable
as $$ select 'https://wduwfjatblkewctsycie.supabase.co/storage/v1/object/public/'::text $$;

do $$
begin
  if public.app_storage_public_base() like '%REF.supabase.co%' then
    raise exception 'Edit app_storage_public_base(): ganti REF dengan project ref Supabase kamu, lalu jalankan ulang.';
  end if;
end $$;

-- ================= 1) NORMALISASI INSTAGRAM =================
create or replace function public.normalize_instagram(p text)
returns text
language sql immutable
as $$
  select case
    when nullif(trim(coalesce(p, '')), '') is null then null
    else '@' || ltrim(regexp_replace(trim(p), '\s+', '', 'g'), '@')
  end
$$;

-- Backfill data lama (jalan sebagai postgres -> guard dilewati)
update public.profiles
set instagram = public.normalize_instagram(instagram)
where nullif(trim(coalesce(instagram, '')), '') is not null
  and instagram is distinct from public.normalize_instagram(instagram)
  and public.normalize_instagram(instagram) ~ '^@[A-Za-z0-9._]{1,30}$';

drop index if exists public.profiles_verified_instagram_uniq;
create unique index profiles_verified_instagram_uniq
  on public.profiles (lower(ltrim(trim(instagram), '@'))) where is_verified;

-- ================= 2) GUARD PROFIL (versi lengkap dari 0050 + avatar, panjang, normalisasi IG) =================
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

    new.instagram := public.normalize_instagram(new.instagram);
    if coalesce(new.instagram, '') <> '' and new.instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
      raise exception 'Format Instagram tidak valid. Contoh: @username (huruf, angka, titik, underscore).';
    end if;

    if coalesce(new.avatar_url, '') <> '' and left(new.avatar_url, length(public.app_storage_public_base())) <> public.app_storage_public_base() then
      raise exception 'URL foto profil tidak valid.';
    end if;

    if char_length(coalesce(new.full_name, '')) > 100 then raise exception 'Nama terlalu panjang (maks 100 karakter).'; end if;
    if char_length(coalesce(new.nickname, '')) > 50 then raise exception 'Nama panggilan terlalu panjang (maks 50 karakter).'; end if;
    if char_length(coalesce(new.location, '')) > 150 then raise exception 'Lokasi terlalu panjang (maks 150 karakter).'; end if;

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

    if nullif(old.gender, '') is not null and new.gender is distinct from old.gender then
      raise exception 'Gender tidak bisa diubah setelah diisi. Hubungi admin kalau salah input.';
    end if;
    if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
      raise exception 'Tanggal lahir tidak bisa diubah setelah diisi. Hubungi admin kalau salah input.';
    end if;

    -- avatar_url: hanya URL storage project sendiri (dicek kalau berubah)
    if new.avatar_url is distinct from old.avatar_url
       and coalesce(new.avatar_url, '') <> ''
       and left(new.avatar_url, length(public.app_storage_public_base())) <> public.app_storage_public_base() then
      raise exception 'URL foto profil tidak valid.';
    end if;
  end if;

  -- Instagram: normalisasi (@ selalu ada) + validasi, hanya kalau berubah
  if new.instagram is distinct from old.instagram then
    new.instagram := public.normalize_instagram(new.instagram);
    if coalesce(new.instagram, '') <> '' and new.instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
      raise exception 'Format Instagram tidak valid. Contoh: @username (huruf, angka, titik, underscore).';
    end if;
  end if;

  -- batas panjang, hanya kalau berubah (data lama tidak ikut terblokir)
  if new.full_name is distinct from old.full_name and char_length(coalesce(new.full_name, '')) > 100 then
    raise exception 'Nama terlalu panjang (maks 100 karakter).';
  end if;
  if new.nickname is distinct from old.nickname and char_length(coalesce(new.nickname, '')) > 50 then
    raise exception 'Nama panggilan terlalu panjang (maks 50 karakter).';
  end if;
  if new.location is distinct from old.location and char_length(coalesce(new.location, '')) > 150 then
    raise exception 'Lokasi terlalu panjang (maks 150 karakter).';
  end if;

  -- ganti Instagram -> verifikasi gugur (harus ajukan ulang)
  if old.is_verified
     and lower(ltrim(trim(coalesce(new.instagram, '')), '@')) is distinct from lower(ltrim(trim(coalesce(old.instagram, '')), '@')) then
    new.is_verified := false;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

-- ================= 3) BATAS PANJANG CIRCLE =================
create or replace function public.guard_circle_text_len()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if (tg_op = 'INSERT' or new.name is distinct from old.name)
     and char_length(coalesce(new.name, '')) > 100 then
    raise exception 'Nama circle terlalu panjang (maks 100 karakter).';
  end if;
  if (tg_op = 'INSERT' or new.group_name is distinct from old.group_name)
     and char_length(coalesce(new.group_name, '')) > 100 then
    raise exception 'Nama grup terlalu panjang (maks 100 karakter).';
  end if;
  if (tg_op = 'INSERT' or new.description is distinct from old.description)
     and char_length(coalesce(new.description, '')) > 2000 then
    raise exception 'Deskripsi terlalu panjang (maks 2000 karakter).';
  end if;
  if (tg_op = 'INSERT' or new.location is distinct from old.location)
     and char_length(coalesce(new.location, '')) > 200 then
    raise exception 'Lokasi terlalu panjang (maks 200 karakter).';
  end if;
  if (tg_op = 'INSERT' or new.city is distinct from old.city)
     and char_length(coalesce(new.city, '')) > 100 then
    raise exception 'Kota terlalu panjang (maks 100 karakter).';
  end if;
  if (tg_op = 'INSERT' or new.join_question is distinct from old.join_question)
     and char_length(coalesce(new.join_question, '')) > 200 then
    raise exception 'Pertanyaan join terlalu panjang (maks 200 karakter).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_a_guard_circle_text_len on public.circles;
create trigger trg_a_guard_circle_text_len
  before insert or update on public.circles
  for each row execute function public.guard_circle_text_len();

-- ================= 4) FILE COVER MILIK USER (hard-delete) =================
create or replace function public.admin_list_user_cover_paths(p_user_id uuid)
returns table (name text)
language sql security definer set search_path = public, storage
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'circle-covers' and o.owner_id = p_user_id::text
$$;

revoke all on function public.admin_list_user_cover_paths(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_user_cover_paths(uuid) to service_role;
