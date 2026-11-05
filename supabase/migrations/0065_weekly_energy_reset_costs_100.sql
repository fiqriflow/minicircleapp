-- Jalankan sekali di Supabase SQL Editor (setelah 0064)
-- Perubahan energy:
--   * Reset mingguan: tiap Senin 00.00 WIB saldo di-SET jadi 1000 (bonus harian dihapus, sisa lama hangus)
--   * Join circle        : -10  -> -100
--   * Buat circle biasa  : -50  -> -100
--   * Buat circle plus   : -100 -> -200
--   * Pelanggaran (tidak check-in): -10 -> -50
-- Samakan konstanta di lib/energy.ts. Penalti lama tetap pakai jumlah yang tercatat saat koreksi host.

-- ================= RESET MINGGUAN =================
create or replace function public.ensure_energy_reset(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_last_reset timestamptz;
  v_this_week timestamp;
  v_last_week timestamp;
begin
  select energy_reset_at into v_last_reset from public.profiles where id = p_user_id;
  if v_last_reset is null then
    return;
  end if;

  -- awal minggu (Senin 00.00) dalam WIB
  v_this_week := date_trunc('week', now() at time zone 'Asia/Jakarta');
  v_last_week := date_trunc('week', v_last_reset at time zone 'Asia/Jakarta');

  if v_last_week < v_this_week then
    perform set_config('app.energy_reason', 'weekly_reset', true);
    -- "and energy_reset_at = v_last_reset" mencegah reset dobel kalau 2 request bersamaan
    update public.profiles
       set energy = 1000,
           energy_reset_at = now()
     where id = p_user_id
       and energy_reset_at = v_last_reset;
    perform set_config('app.energy_reason', '', true);
  end if;
end;
$$;

-- ================= JOIN: -100 =================
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

  perform public.charge_energy(new.user_id, 100, 'join circle');
  return new;
end;
$$;

-- ================= BUAT CIRCLE: -100 (plus: -200) =================
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
    case when coalesce(new.is_circle_plus, false) then 200 else 100 end,
    case when coalesce(new.is_circle_plus, false) then 'membuat circle plus' else 'membuat circle' end
  );
  return new;
end;
$$;

-- ================= PELANGGARAN (tidak check-in): -50 =================
create or replace function public.apply_no_show_penalty(p_user_id uuid, p_member_id uuid)
returns table (amount integer, balance integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_before integer;
  v_amount integer;
begin
  perform public.ensure_energy_reset(p_user_id);

  select energy into v_before from public.profiles where id = p_user_id;
  v_amount := least(50, greatest(coalesce(v_before, 0), 0));

  if v_amount > 0 then
    perform set_config('app.energy_reason', 'no_show', true);
    update public.profiles set energy = energy - v_amount where id = p_user_id;
    perform set_config('app.energy_reason', '', true);
  end if;

  insert into public.circle_member_penalties (member_id, amount)
  values (p_member_id, v_amount)
  on conflict (member_id) do update set amount = excluded.amount;

  return query select v_amount, coalesce(v_before, 0) - v_amount;
end;
$$;
revoke all on function public.apply_no_show_penalty(uuid, uuid) from public, anon, authenticated;
