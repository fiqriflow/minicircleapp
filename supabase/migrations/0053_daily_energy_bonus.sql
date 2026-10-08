-- Jalankan sekali di Supabase SQL Editor (setelah 0052)
-- Bonus energy: dulu +10 tiap Senin -> sekarang +50 TIAP HARI 00:00 WIB, akumulasi
-- (hari terlewat tetap dihitung, lazy saat user buka app / melakukan aksi).
-- Ubah angka bonus: cari "50" di bawah, dan samakan DAILY_ENERGY_BONUS di lib/energy.ts.
-- Catatan: bonus mingguan yang sudah diberikan sebelumnya tidak diubah.

create or replace function public.ensure_energy_reset(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_last_reset timestamptz;
  v_today date;
  v_last_day date;
  v_days int;
begin
  select energy_reset_at into v_last_reset from public.profiles where id = p_user_id;
  if v_last_reset is null then
    return;
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;
  v_last_day := (v_last_reset at time zone 'Asia/Jakarta')::date;
  v_days := v_today - v_last_day;

  if v_days > 0 then
    -- "and energy_reset_at = v_last_reset" mencegah bonus dihitung dobel kalau 2 request bersamaan
    update public.profiles
       set energy = energy + 50 * v_days,
           energy_reset_at = now()
     where id = p_user_id
       and energy_reset_at = v_last_reset;
  end if;
end;
$$;
