-- Jalankan sekali di Supabase SQL Editor (setelah 0031)
-- Sistem ENERGY jadi KREDIT (saldo), bukan reset mingguan 7.
--   * Akun baru            : 1000 energy
--   * Join circle          : -1   (host tidak kena biaya untuk circle buatannya sendiri)
--   * Buat circle          : -10
--   * Buat circle plus     : -100
--   * Bonus mingguan       : +10 tiap Senin 00:00 WIB, AKUMULASI (minggu terlewat tetap dihitung)
--   * Energy tidak cukup   : aksi ditolak -> user hubungi admin; admin tambah lewat halaman /admin/energy
--   * Penalti no-show      : tetap -1 (minimal 0), refund koreksi host tetap +1 (tanpa batas atas)
-- Ubah angka biaya/bonus di function charge_energy / check_and_deduct_energy /
-- charge_join_energy / ensure_energy_reset (cari angka 1, 10, 100, 10).

-- ================= 1) DEFAULT & SALDO AWAL =================
alter table public.profiles alter column energy set default 1000;

-- SEKALI JALAN: semua user yang sudah ada diset ke 1000 (ubah angkanya kalau mau lain).
-- energy_reset_at dipakai sebagai penanda "bonus mingguan terakhir dihitung".
update public.profiles set energy = 1000, energy_reset_at = now();

-- snapshot energy dari hapus-akun (0030) masih berisi nilai sistem lama (0-7)
update public.profile_energy_snapshot set energy = 1000;

-- ================= 2) BONUS MINGGUAN AKUMULATIF =================
-- Dulu: reset ke 7. Sekarang: tambah 10 per Senin 00:00 WIB yang sudah terlewat sejak
-- terakhir dihitung (energy_reset_at). Lazy: dihitung saat user melakukan aksi / buka app.
create or replace function public.ensure_energy_reset(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_last_reset timestamptz;
  v_this_monday date;
  v_last_monday date;
  v_weeks int;
begin
  select energy_reset_at into v_last_reset from public.profiles where id = p_user_id;
  if v_last_reset is null then
    return;
  end if;

  -- date_trunc('week') di Postgres = Senin (ISO)
  v_this_monday := date_trunc('week', now() at time zone 'Asia/Jakarta')::date;
  v_last_monday := date_trunc('week', v_last_reset at time zone 'Asia/Jakarta')::date;
  v_weeks := (v_this_monday - v_last_monday) / 7;

  if v_weeks > 0 then
    -- "and energy_reset_at = v_last_reset" mencegah bonus dihitung dobel kalau 2 request bersamaan
    update public.profiles
       set energy = energy + 10 * v_weeks,
           energy_reset_at = now()
     where id = p_user_id
       and energy_reset_at = v_last_reset;
  end if;
end;
$$;

-- ================= 3) HELPER POTONG ENERGY (internal) =================
create or replace function public.charge_energy(p_user_id uuid, p_cost integer, p_label text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_energy integer;
begin
  select energy into v_energy from public.profiles where id = p_user_id;
  if not found then
    return null; -- profil tidak ketemu: jangan blokir hal lain
  end if;

  perform public.ensure_energy_reset(p_user_id);

  update public.profiles
     set energy = energy - p_cost
   where id = p_user_id and energy >= p_cost
  returning energy into v_energy;

  if not found then
    select energy into v_energy from public.profiles where id = p_user_id;
    raise exception 'Energy kamu tidak cukup untuk % (butuh %, sisa %). Hubungi admin untuk menambah energy.',
      p_label, p_cost, coalesce(v_energy, 0);
  end if;

  return v_energy;
end;
$$;
revoke all on function public.charge_energy(uuid, integer, text) from public, anon, authenticated;

-- ================= 4) BUAT CIRCLE: -10 (plus: -100) =================
create or replace function public.check_and_deduct_energy()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.created_by is null then
    return new;
  end if;

  perform public.charge_energy(
    new.created_by,
    case when coalesce(new.is_circle_plus, false) then 100 else 10 end,
    case when coalesce(new.is_circle_plus, false) then 'membuat circle plus' else 'membuat circle' end
  );
  return new;
end;
$$;

-- ================= 5) JOIN CIRCLE: -1 =================
-- AFTER INSERT: hanya jalan kalau baris benar-benar masuk (on conflict do nothing tidak dipotong).
-- Kalau energy kurang, exception -> seluruh insert di-rollback.
create or replace function public.charge_join_energy()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_host uuid;
begin
  select created_by into v_host from public.circles where id = new.circle_id;
  if new.user_id is not distinct from v_host then
    return new; -- host masuk ke circle buatannya sendiri: gratis
  end if;

  perform public.charge_energy(new.user_id, 1, 'join circle');
  return new;
end;
$$;

drop trigger if exists trg_charge_join_energy on public.circle_members;
create trigger trg_charge_join_energy
  after insert on public.circle_members
  for each row execute function public.charge_join_energy();

-- ================= 6) ADMIN: TAMBAH / KURANGI ENERGY (atomik) =================
create or replace function public.admin_adjust_energy(p_user_id uuid, p_delta integer)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_new integer;
begin
  if not public.is_super_admin_caller() then
    raise exception 'Hanya admin yang boleh mengubah energy';
  end if;

  perform public.ensure_energy_reset(p_user_id);

  update public.profiles
     set energy = greatest(0, energy + p_delta)
   where id = p_user_id
  returning energy into v_new;

  if not found then
    raise exception 'User tidak ditemukan';
  end if;
  return v_new;
end;
$$;
revoke all on function public.admin_adjust_energy(uuid, integer) from public, anon;
grant execute on function public.admin_adjust_energy(uuid, integer) to authenticated;

-- ================= 7) PENALTI NO-SHOW & KOREKSI HOST (hapus "/7" dan batas atas) =================
create or replace function public.penalize_no_show()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_member record;
  v_new_energy int;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    for v_member in
      select user_id from public.circle_members
      where circle_id = new.id and status = 'joined' and checked_in = false
    loop
      perform public.ensure_energy_reset(v_member.user_id);

      update public.profiles set energy = greatest(0, energy - 1)
      where id = v_member.user_id
      returning energy into v_new_energy;

      update public.circle_members set energy_penalized = true
      where circle_id = new.id and user_id = v_member.user_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_member.user_id,
        new.id,
        'no_show_energy',
        'Kamu gak check-in di circle "' || new.name || '", energy kamu dikurangi 1 (sisa ' || coalesce(v_new_energy, 0) || '). Jangan lupa check-in ya lain kali!'
      );
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.host_set_checkin(p_member_row_id uuid, p_checked_in boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_new_energy int;
begin
  select cm.*, c.created_by as host_id, c.status as circle_status, c.name as circle_name
    into v_row
  from public.circle_members cm
  join public.circles c on c.id = cm.circle_id
  where cm.id = p_member_row_id;

  if v_row.id is null then
    raise exception 'Data member tidak ditemukan';
  end if;

  if v_row.host_id is null or v_row.host_id <> auth.uid() then
    raise exception 'Cuma host circle yang boleh koreksi check-in';
  end if;

  update public.circle_members
  set checked_in = p_checked_in,
      checked_in_at = case when p_checked_in then now() else null end
  where id = p_member_row_id;

  -- energy cuma disesuaikan kalau circle-nya udah selesai
  if v_row.circle_status = 'completed' then
    if p_checked_in and v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      update public.profiles set energy = energy + 1
      where id = v_row.user_id
      returning energy into v_new_energy;

      update public.circle_members set energy_penalized = false where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Hadir, energy kamu dikembalikan (sisa ' || coalesce(v_new_energy, 0) || ').'
      );
    elsif not p_checked_in and not v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      update public.profiles set energy = greatest(0, energy - 1)
      where id = v_row.user_id
      returning energy into v_new_energy;

      update public.circle_members set energy_penalized = true where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Tidak Hadir, energy kamu dikurangi 1 (sisa ' || coalesce(v_new_energy, 0) || ').'
      );
    end if;
  end if;
end;
$$;
revoke all on function public.host_set_checkin(uuid, boolean) from public, anon;
grant execute on function public.host_set_checkin(uuid, boolean) to authenticated;

-- ================= 8) PROFIL BARU = 1000 ENERGY (versi lengkap guard dari 0030) =================
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
    new.is_super_admin := false;
    new.is_banned := false;
    new.suspended_until := null;
    new.suspension_reason := null;
    new.energy := 1000;
    new.energy_reset_at := now();

    -- pernah hapus akun sendiri? pulihkan energy terakhir (bukan reset ke saldo awal)
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
