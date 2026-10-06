-- Jalankan sekali di Supabase SQL Editor (setelah 0045)
-- Verifikasi akun gratis lewat kode di bio Instagram + review admin -> badge centang biru.
-- Alur: user ajukan -> dapat kode unik -> tempel di bio IG -> admin cek bio -> setujui/tolak.
-- Verifikasi otomatis dicabut kalau user mengganti Instagram. 1 Instagram hanya untuk 1 akun verified.

-- ================= 1) KOLOM PROFIL =================
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verified_at timestamptz;
grant select (is_verified, verified_at) on public.profiles to authenticated; -- select kolom dibatasi sejak 0028

create unique index if not exists profiles_verified_instagram_uniq
  on public.profiles (lower(trim(instagram))) where is_verified;

-- ================= 2) GUARD PROFIL (versi lengkap dari 0034 + verifikasi) =================
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
    -- verifikasi hanya lewat RPC admin
    new.is_verified := old.is_verified;
    new.verified_at := old.verified_at;
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

-- ================= 3) TABEL PENGAJUAN =================
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  instagram text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists verification_requests_one_pending
  on public.verification_requests (user_id) where status = 'pending';
create index if not exists verification_requests_status_idx
  on public.verification_requests (status, created_at);

alter table public.verification_requests enable row level security;
drop policy if exists "verification_select_own_or_admin" on public.verification_requests;
create policy "verification_select_own_or_admin" on public.verification_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin_caller()));
revoke all on public.verification_requests from anon, authenticated;
grant select on public.verification_requests to authenticated; -- tulis hanya lewat RPC

-- ================= 4) USER: AJUKAN VERIFIKASI =================
create or replace function public.request_verification()
returns setof public.verification_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_row public.verification_requests;
begin
  if v_uid is null then
    raise exception 'Belum login';
  end if;
  if public.is_account_blocked() then
    raise exception 'Akun sedang dinonaktifkan.';
  end if;

  select instagram, avatar_url, is_verified into v_prof from public.profiles where id = v_uid;
  if coalesce(v_prof.is_verified, false) then
    raise exception 'Akun kamu sudah terverifikasi.';
  end if;
  if coalesce(trim(v_prof.instagram), '') = '' or coalesce(trim(v_prof.avatar_url), '') = '' then
    raise exception 'Lengkapi foto profil & Instagram dulu (Profil > Data Diri).';
  end if;

  select * into v_row from public.verification_requests
  where user_id = v_uid and status = 'pending';
  if found then
    -- Instagram diganti setelah mengajukan -> samakan snapshot
    if v_row.instagram is distinct from v_prof.instagram then
      update public.verification_requests set instagram = v_prof.instagram
      where id = v_row.id returning * into v_row;
    end if;
    return next v_row;
    return;
  end if;

  if (select count(*) from public.verification_requests
      where user_id = v_uid and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Terlalu sering mengajukan, coba lagi besok.';
  end if;

  insert into public.verification_requests (user_id, code, instagram)
  values (
    v_uid,
    'MINCLE-' || upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 6)),
    v_prof.instagram
  )
  returning * into v_row;

  return next v_row;
  return;
end;
$$;
revoke all on function public.request_verification() from public, anon;
grant execute on function public.request_verification() to authenticated;

-- ================= 5) ADMIN: SETUJUI / TOLAK =================
create or replace function public.admin_review_verification(p_request_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_req public.verification_requests;
  v_ig text;
begin
  if not public.is_super_admin_caller() then
    raise exception 'Khusus super admin';
  end if;

  select * into v_req from public.verification_requests
  where id = p_request_id and status = 'pending' for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses';
  end if;

  if p_approve then
    select instagram into v_ig from public.profiles where id = v_req.user_id;
    if lower(trim(coalesce(v_ig, ''))) is distinct from lower(trim(v_req.instagram)) then
      raise exception 'Instagram user sudah berubah sejak pengajuan, minta user ajukan ulang';
    end if;
    if exists (
      select 1 from public.profiles
      where is_verified and id <> v_req.user_id and lower(trim(instagram)) = lower(trim(v_req.instagram))
    ) then
      raise exception 'Instagram ini sudah dipakai akun terverifikasi lain';
    end if;

    update public.profiles set is_verified = true, verified_at = now() where id = v_req.user_id;
    update public.verification_requests
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
    where id = v_req.id;

    insert into public.notifications (user_id, type, message)
    values (v_req.user_id, 'verification_approved', 'Selamat! Akunmu sudah terverifikasi (centang biru).');
  else
    update public.verification_requests
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
        reject_reason = nullif(left(trim(coalesce(p_reason, '')), 200), '')
    where id = v_req.id;

    insert into public.notifications (user_id, type, message)
    values (
      v_req.user_id, 'verification_rejected',
      'Verifikasi ditolak: ' || coalesce(nullif(left(trim(coalesce(p_reason, '')), 200), ''), 'kode belum terlihat di bio Instagram')
      || '. Kamu bisa ajukan lagi.'
    );
  end if;
end;
$$;
revoke all on function public.admin_review_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;

-- ================= 6) ADMIN: CABUT / BERI MANUAL =================
create or replace function public.admin_set_verified(p_user_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin_caller() then
    raise exception 'Khusus super admin';
  end if;
  if p_value and exists (
    select 1 from public.profiles me
    join public.profiles o on o.id <> me.id and o.is_verified and lower(trim(o.instagram)) = lower(trim(me.instagram))
    where me.id = p_user_id and coalesce(trim(me.instagram), '') <> ''
  ) then
    raise exception 'Instagram ini sudah dipakai akun terverifikasi lain';
  end if;
  update public.profiles
  set is_verified = p_value, verified_at = case when p_value then now() else null end
  where id = p_user_id;
end;
$$;
revoke all on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;
