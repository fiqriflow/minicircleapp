-- Jalankan sekali di Supabase SQL Editor (setelah 0062)
-- Biaya energi baru:
--   Join circle           : -1  -> -10
--   Tidak check-in        : -1  -> -10  (koreksi host mengembalikan/memotong 10 juga)
--   Buat circle biasa     : -10 -> -50
--   Buat circle plus      : -100 (tetap)
-- Samakan ENERGY_COST & NO_SHOW_PENALTY di lib/energy.ts.
-- Penalti yang sudah terjadi sebelumnya tidak diubah.

-- ================= JOIN: -10 =================
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

  perform public.charge_energy(new.user_id, 10, 'join circle');
  return new;
end;
$$;

-- ================= BUAT CIRCLE: -50 (plus: -100) =================
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
    case when coalesce(new.is_circle_plus, false) then 100 else 50 end,
    case when coalesce(new.is_circle_plus, false) then 'membuat circle plus' else 'membuat circle' end
  );
  return new;
end;
$$;

-- ================= PENALTI TIDAK CHECK-IN: -10 =================
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

      perform set_config('app.energy_reason', 'no_show', true);
      update public.profiles set energy = greatest(0, energy - 10)
      where id = v_member.user_id
      returning energy into v_new_energy;
      perform set_config('app.energy_reason', '', true);

      update public.circle_members set energy_penalized = true
      where circle_id = new.id and user_id = v_member.user_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_member.user_id,
        new.id,
        'no_show_energy',
        'Kamu gak check-in di circle "' || new.name || '", energy kamu dikurangi 10 (sisa ' || coalesce(v_new_energy, 0) || '). Jangan lupa check-in ya lain kali!'
      );
    end loop;
  end if;
  return new;
end;
$$;

-- ================= KOREKSI HOST: ±10 =================
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

  if (v_row.host_id is null or v_row.host_id <> auth.uid())
     and not public.is_circle_cohost(v_row.circle_id) then
    raise exception 'Cuma host / co host circle yang boleh koreksi check-in';
  end if;

  update public.circle_members
  set checked_in = p_checked_in,
      checked_in_at = case when p_checked_in then now() else null end
  where id = p_member_row_id;

  -- energy cuma disesuaikan kalau circle-nya udah selesai
  if v_row.circle_status = 'completed' then
    if p_checked_in and v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      perform set_config('app.energy_reason', 'host_correction', true);
      update public.profiles set energy = energy + 10
      where id = v_row.user_id
      returning energy into v_new_energy;
      perform set_config('app.energy_reason', '', true);

      update public.circle_members set energy_penalized = false where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Hadir, energy kamu dikembalikan 10 (sisa ' || coalesce(v_new_energy, 0) || ').'
      );
    elsif not p_checked_in and not v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      perform set_config('app.energy_reason', 'no_show', true);
      update public.profiles set energy = greatest(0, energy - 10)
      where id = v_row.user_id
      returning energy into v_new_energy;
      perform set_config('app.energy_reason', '', true);

      update public.circle_members set energy_penalized = true where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Tidak Hadir, energy kamu dikurangi 10 (sisa ' || coalesce(v_new_energy, 0) || ').'
      );
    end if;
  end if;
end;
$$;
revoke all on function public.host_set_checkin(uuid, boolean) from public, anon;
grant execute on function public.host_set_checkin(uuid, boolean) to authenticated;

-- ================= PENCATAT RIWAYAT (dari 0062): fallback tanpa tebakan ±1 =================
create or replace function public.log_energy_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_delta integer;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    insert into public.energy_ledger (user_id, delta, balance, reason)
    values (new.id, new.energy, new.energy, 'initial');
    return new;
  end if;

  if new.energy is not distinct from old.energy then
    return new;
  end if;

  v_delta := new.energy - old.energy;
  v_reason := coalesce(nullif(current_setting('app.energy_reason', true), ''), 'other');
  perform set_config('app.energy_reason', '', true);

  insert into public.energy_ledger (user_id, delta, balance, reason)
  values (new.id, v_delta, new.energy, v_reason);
  return new;
end;
$$;
