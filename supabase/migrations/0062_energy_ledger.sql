-- Jalankan sekali di Supabase SQL Editor (setelah 0061)
-- Rincian energi: catat setiap perubahan saldo energi (bonus, join, buat circle, penalti, koreksi, admin).
--  1) tabel energy_ledger (user hanya bisa BACA riwayat miliknya; admin baca semua; tulis hanya lewat trigger)
--  2) trigger di profiles: setiap perubahan kolom energy otomatis dicatat
--     alasan dibaca dari setting transaksi 'app.energy_reason' (diisi function energi di bawah);
--     kalau kosong: delta -1 = penalti tidak check-in, +1 = koreksi host, lainnya = penyesuaian
--  3) function energi (charge_energy, ensure_energy_reset, admin_adjust_energy) diberi penanda alasan
--  4) saldo saat ini dicatat sebagai 'opening' supaya riwayat bisa dihitung mundur

-- ================= 1) TABEL =================
create table if not exists public.energy_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  balance integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists energy_ledger_user_idx on public.energy_ledger (user_id, id desc);

alter table public.energy_ledger enable row level security;
revoke all on public.energy_ledger from anon, authenticated;
grant select on public.energy_ledger to authenticated;

drop policy if exists "energy_ledger_select_own" on public.energy_ledger;
create policy "energy_ledger_select_own" on public.energy_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_super_admin_caller()));

-- ================= 2) TRIGGER PENCATAT =================
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
  v_reason := nullif(current_setting('app.energy_reason', true), '');
  if v_reason is null then
    v_reason := case v_delta when -1 then 'no_show' when 1 then 'host_correction' else 'other' end;
  end if;
  perform set_config('app.energy_reason', '', true); -- jangan bocor ke update berikutnya

  insert into public.energy_ledger (user_id, delta, balance, reason)
  values (new.id, v_delta, new.energy, v_reason);
  return new;
end;
$$;

drop trigger if exists trg_z_log_energy_change on public.profiles;
create trigger trg_z_log_energy_change
  after insert or update of energy on public.profiles
  for each row execute function public.log_energy_change();

-- ================= 3) PENANDA ALASAN DI FUNCTION ENERGI =================
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

  perform set_config('app.energy_reason',
    case p_label
      when 'join circle' then 'join_circle'
      when 'membuat circle plus' then 'create_circle_plus'
      when 'membuat circle' then 'create_circle'
      else 'other'
    end, true);

  update public.profiles
     set energy = energy - p_cost
   where id = p_user_id and energy >= p_cost
  returning energy into v_energy;

  if not found then
    perform set_config('app.energy_reason', '', true);
    select energy into v_energy from public.profiles where id = p_user_id;
    raise exception 'Energy kamu tidak cukup untuk % (butuh %, sisa %). Hubungi admin untuk menambah energy.',
      p_label, p_cost, coalesce(v_energy, 0);
  end if;

  return v_energy;
end;
$$;
revoke all on function public.charge_energy(uuid, integer, text) from public, anon, authenticated;

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
    perform set_config('app.energy_reason', 'daily_bonus', true);
    -- "and energy_reset_at = v_last_reset" mencegah bonus dihitung dobel kalau 2 request bersamaan
    update public.profiles
       set energy = energy + 100 * v_days,
           energy_reset_at = now()
     where id = p_user_id
       and energy_reset_at = v_last_reset;
    perform set_config('app.energy_reason', '', true);
  end if;
end;
$$;

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

  perform set_config('app.energy_reason', 'admin_adjust', true);
  update public.profiles
     set energy = greatest(0, energy + p_delta)
   where id = p_user_id
  returning energy into v_new;

  if not found then
    perform set_config('app.energy_reason', '', true);
    raise exception 'User tidak ditemukan';
  end if;
  return v_new;
end;
$$;
revoke all on function public.admin_adjust_energy(uuid, integer) from public, anon;
grant execute on function public.admin_adjust_energy(uuid, integer) to authenticated;

-- ================= 4) SALDO AWAL PENCATATAN =================
insert into public.energy_ledger (user_id, delta, balance, reason)
select p.id, p.energy, p.energy, 'opening'
from public.profiles p
where not exists (select 1 from public.energy_ledger l where l.user_id = p.id);
