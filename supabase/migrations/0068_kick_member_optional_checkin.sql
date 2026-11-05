-- Jalankan sekali di Supabase SQL Editor (setelah 0067)
-- 1) Opsi circle: pakai check-in atau tidak (circles.require_checkin, default true = perilaku lama)
--      * tanpa check-in: tidak ada penalti tidak-hadir, koreksi host dimatikan, statistik menganggap peserta hadir
--      * tidak bisa diubah setelah circle dimulai / selesai / lewat jam mulai
-- 2) Host & co host bisa mengeluarkan peserta (kick) SEBELUM circle dimulai; energy join (-100) dikembalikan.
--      * co host tidak bisa mengeluarkan host atau co host lain
-- Samakan jumlah refund (100) dengan ENERGY_COST.join di lib/energy.ts.

-- ================= 1) KOLOM require_checkin =================
alter table public.circles add column if not exists require_checkin boolean not null default true;
grant select (require_checkin) on public.circles to authenticated; -- select kolom dibatasi sejak 0048

-- kunci perubahan setelah circle dimulai (kalau dilanggar: nilai lama dipertahankan, tanpa error)
create or replace function public.lock_require_checkin()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.require_checkin is distinct from old.require_checkin
     and not public.is_super_admin_caller()
     and (old.started_at is not null or old.status <> 'active' or old.event_date <= now()) then
    new.require_checkin := old.require_checkin;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_lock_require_checkin on public.circles;
create trigger trg_lock_require_checkin
  before update on public.circles
  for each row execute function public.lock_require_checkin();

-- ================= penalti otomatis: lewati circle tanpa check-in =================
create or replace function public.penalize_no_show()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_member record;
  v_amount integer;
  v_balance integer;
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and coalesce(new.require_checkin, true) then
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

-- ================= koreksi host: mati untuk circle tanpa check-in =================
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
  select cm.*, c.created_by as host_id, c.status as circle_status, c.name as circle_name,
         coalesce(c.require_checkin, true) as require_checkin
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

  if not v_row.require_checkin then
    raise exception 'Circle ini tidak memakai check-in';
  end if;

  update public.circle_members
  set checked_in = p_checked_in,
      checked_in_at = case when p_checked_in then now() else null end
  where id = p_member_row_id;

  -- energy cuma disesuaikan kalau circle-nya udah selesai
  if v_row.circle_status = 'completed' then
    if p_checked_in and v_row.energy_penalized then
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

-- ================= 2) KICK PESERTA =================
create or replace function public.kick_member(p_member_row_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_is_host boolean;
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;

  select cm.id, cm.user_id, cm.status, cm.is_co_host, cm.circle_id,
         c.created_by, c.status as circle_status, c.started_at, c.event_date, c.name
    into v_row
  from public.circle_members cm
  join public.circles c on c.id = cm.circle_id
  where cm.id = p_member_row_id
  for update of cm;

  if v_row.id is null then
    raise exception 'Peserta tidak ditemukan';
  end if;

  v_is_host := v_row.created_by = auth.uid();
  if not v_is_host and not public.is_circle_cohost(v_row.circle_id) then
    raise exception 'Hanya host / co host yang boleh mengeluarkan peserta';
  end if;

  if v_row.user_id = v_row.created_by then
    raise exception 'Host tidak bisa dikeluarkan';
  end if;
  if v_row.user_id = auth.uid() then
    raise exception 'Tidak bisa mengeluarkan diri sendiri';
  end if;
  if v_row.is_co_host and not v_is_host then
    raise exception 'Co host hanya bisa dikeluarkan oleh host';
  end if;
  if v_row.status <> 'joined' then
    raise exception 'Hanya peserta yang sudah join yang bisa dikeluarkan (permintaan pending cukup ditolak)';
  end if;
  if v_row.circle_status <> 'active' or v_row.started_at is not null or v_row.event_date <= now() then
    raise exception 'Peserta hanya bisa dikeluarkan sebelum circle dimulai';
  end if;

  delete from public.circle_members where id = p_member_row_id;

  -- kembalikan energy join (-100). ensure_energy_reset dulu supaya refund tidak tertimpa reset mingguan.
  perform public.ensure_energy_reset(v_row.user_id);
  perform set_config('app.energy_reason', 'kick_refund', true);
  update public.profiles set energy = energy + 100 where id = v_row.user_id;
  perform set_config('app.energy_reason', '', true);
  select energy into v_balance from public.profiles where id = v_row.user_id;

  insert into public.notifications (user_id, circle_id, type, message)
  values (
    v_row.user_id, v_row.circle_id, 'kicked',
    'Kamu dikeluarkan dari circle "' || v_row.name || '" oleh host. Energy 100 dikembalikan (sisa ' || coalesce(v_balance, 0) || ').'
  );
end;
$$;
revoke all on function public.kick_member(uuid) from public, anon;
grant execute on function public.kick_member(uuid) to authenticated;
