-- Jalankan sekali di Supabase SQL Editor (setelah 0063)
-- Perbaikan penalti tidak check-in:
--   * Penalti hanya memotong energi yang benar-benar ada (saldo tidak pernah di bawah 0).
--   * Jumlah yang benar-benar terpotong disimpan, dan koreksi host mengembalikan jumlah itu saja
--     (sebelumnya selalu +10 walau yang terpotong lebih kecil = energi gratis).
--   * Pesan notifikasi menampilkan jumlah sebenarnya.
-- Jumlah disimpan di tabel terpisah yang tidak bisa diakses client (hindari manipulasi lewat UPDATE).
-- Penalti lama (sebelum migration ini) tidak punya catatan: dianggap 1 energi saat dikoreksi (angka lama).

-- ================= TABEL JUMLAH PENALTI (server-only) =================
create table if not exists public.circle_member_penalties (
  member_id uuid primary key references public.circle_members(id) on delete cascade,
  amount integer not null check (amount >= 0)
);
alter table public.circle_member_penalties enable row level security;
revoke all on public.circle_member_penalties from anon, authenticated;

-- ================= HELPER: potong penalti sesuai saldo =================
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
  v_amount := least(10, greatest(coalesce(v_before, 0), 0));

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

-- ================= PENALTI OTOMATIS SAAT CIRCLE SELESAI =================
create or replace function public.penalize_no_show()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_member record;
  v_amount integer;
  v_balance integer;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    for v_member in
      select id, user_id from public.circle_members
      where circle_id = new.id and status = 'joined' and checked_in = false
    loop
      select p.amount, p.balance into v_amount, v_balance
      from public.apply_no_show_penalty(v_member.user_id, v_member.id) p;

      update public.circle_members set energy_penalized = true where id = v_member.id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_member.user_id,
        new.id,
        'no_show_energy',
        case when v_amount > 0
          then 'Kamu gak check-in di circle "' || new.name || '", energy kamu dikurangi ' || v_amount || ' (sisa ' || v_balance || '). Jangan lupa check-in ya lain kali!'
          else 'Kamu gak check-in di circle "' || new.name || '". Energy kamu sudah 0 jadi tidak ada yang dipotong. Jangan lupa check-in ya lain kali!'
        end
      );
    end loop;
  end if;
  return new;
end;
$$;

-- ================= KOREKSI HOST: kembalikan / potong sesuai jumlah sebenarnya =================
create or replace function public.host_set_checkin(p_member_row_id uuid, p_checked_in boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_amount integer;
  v_balance integer;
  v_refund integer;
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
      -- kembalikan HANYA jumlah yang dulu benar-benar terpotong (data lama tanpa catatan = 1)
      select coalesce((select amount from public.circle_member_penalties where member_id = p_member_row_id), 1)
        into v_refund;

      perform public.ensure_energy_reset(v_row.user_id);
      if v_refund > 0 then
        perform set_config('app.energy_reason', 'host_correction', true);
        update public.profiles set energy = energy + v_refund where id = v_row.user_id;
        perform set_config('app.energy_reason', '', true);
      end if;
      select energy into v_balance from public.profiles where id = v_row.user_id;

      delete from public.circle_member_penalties where member_id = p_member_row_id;
      update public.circle_members set energy_penalized = false where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        case when v_refund > 0
          then 'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Hadir, energy kamu dikembalikan ' || v_refund || ' (sisa ' || coalesce(v_balance, 0) || ').'
          else 'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Hadir. Tidak ada energy yang perlu dikembalikan (sisa ' || coalesce(v_balance, 0) || ').'
        end
      );
    elsif not p_checked_in and not v_row.energy_penalized then
      select p.amount, p.balance into v_amount, v_balance
      from public.apply_no_show_penalty(v_row.user_id, p_member_row_id) p;

      update public.circle_members set energy_penalized = true where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        case when v_amount > 0
          then 'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Tidak Hadir, energy kamu dikurangi ' || v_amount || ' (sisa ' || v_balance || ').'
          else 'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Tidak Hadir. Energy kamu sudah 0 jadi tidak ada yang dipotong.'
        end
      );
    end if;
  end if;
end;
$$;
revoke all on function public.host_set_checkin(uuid, boolean) from public, anon;
grant execute on function public.host_set_checkin(uuid, boolean) to authenticated;
