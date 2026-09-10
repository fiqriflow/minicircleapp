-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Energy untuk limit pembuatan circle.
-- - Setiap user (termasuk admin) punya energy, default 7.
-- - Setiap berhasil BUAT circle baru (insert), energy -1.
-- - Energy reset otomatis ke 7 setiap Senin jam 00:00 WIB (Asia/Jakarta).
-- - Kalau energy habis (<=0), insert circle baru ditolak di level DB.
-- - Reset mingguan dihitung lazy (dicek ulang tiap ada aktivitas terkait energy),
--   jadi tidak butuh cron job terpisah.

-- 1) Kolom energy di profiles
alter table profiles add column if not exists energy integer not null default 7;
alter table profiles add column if not exists energy_reset_at timestamptz not null default now();

-- 2) Helper: reset energy user kalau sudah lewat boundary Senin 00:00 WIB minggu ini
create or replace function public.ensure_energy_reset(p_user_id uuid)
returns void as $$
declare
  v_now_wib timestamp;
  v_dow int;
  v_boundary timestamptz;
  v_last_reset timestamptz;
begin
  v_now_wib := now() at time zone 'Asia/Jakarta';
  v_dow := extract(isodow from v_now_wib); -- Senin=1 .. Minggu=7
  v_boundary := (date_trunc('day', v_now_wib) - ((v_dow - 1) || ' days')::interval) at time zone 'Asia/Jakarta';

  select energy_reset_at into v_last_reset from profiles where id = p_user_id;

  if v_last_reset is not null and v_last_reset < v_boundary then
    update profiles set energy = 7, energy_reset_at = now() where id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

-- 3) Trigger: setiap insert circle baru, pastikan reset dulu lalu potong 1 energy host.
--    Kalau energy habis, tolak insert-nya.
create or replace function public.check_and_deduct_energy()
returns trigger as $$
declare
  v_energy int;
begin
  if new.created_by is null then
    return new;
  end if;

  perform public.ensure_energy_reset(new.created_by);

  select energy into v_energy from profiles where id = new.created_by;

  if v_energy is null then
    return new; -- profile tidak ketemu, biarkan (jangan blokir hal lain)
  end if;

  if v_energy <= 0 then
    raise exception 'Energy kamu sudah habis. Tunggu reset otomatis setiap Senin 00:00 ya.';
  end if;

  update profiles set energy = energy - 1 where id = new.created_by;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_check_and_deduct_energy on circles;
create trigger trg_check_and_deduct_energy
  before insert on circles
  for each row execute procedure public.check_and_deduct_energy();

-- 4) RPC dipanggil dari client untuk baca energy TERKINI milik diri sendiri
--    (sekalian trigger lazy-reset kalau sudah lewat Senin, tanpa harus nunggu
--    user bikin circle dulu).
create or replace function public.get_my_energy()
returns table(energy integer, energy_reset_at timestamptz) as $$
begin
  perform public.ensure_energy_reset(auth.uid());
  return query select p.energy, p.energy_reset_at from profiles p where p.id = auth.uid();
end;
$$ language plpgsql security definer;

grant execute on function public.get_my_energy() to authenticated;

-- 5) Refresh admin_player_view supaya kolom energy & energy_reset_at ikut kebawa
--    (p.* di view di-freeze saat create, lihat catatan di migration 0017).
drop view if exists public.admin_player_view;

create view public.admin_player_view as
select p.*, u.email
from public.profiles p
join auth.users u on u.id = p.id
where exists (
  select 1 from public.profiles me where me.id = auth.uid() and me.is_super_admin
);

grant select on public.admin_player_view to authenticated;
