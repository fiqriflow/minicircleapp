-- Jalankan sekali di Supabase SQL Editor (setelah 0040; kalau 0040 belum dijalankan, 0041 ini tetap aman dijalankan sendiri)
-- Perubahan: circle TIDAK lagi selesai otomatis karena waktu / jam selesai.
--  1) Jam selesai dibuang (event_end_date) -> selesai hanya lewat tombol "Tandai Selesai" dari host
--  2) Host lupa -> notif pengingat esok harinya (mulai 08.00 WIB), sekali per circle
--  3) Batas slot tetap: Circle maks 7, Circle+ maks 32
--  4) Check-in member dibuka dari jam mulai sampai circle ditandai selesai (maks 24 jam setelah jam mulai)

-- ================= 1) BATAS SLOT (idempotent, sama dengan 0040) =================
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.circles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%max_participants%'
  loop
    execute format('alter table public.circles drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.circles
  add constraint circles_max_participants_check
  check (max_participants between 3 and 32);

-- guard slot per tipe (tanpa validasi jam selesai). Circle lama yang slotnya > 7 tetap aman:
-- batas hanya dicek saat circle baru / slot dinaikkan.
create or replace function public.guard_circle_limits()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_plus boolean := coalesce(new.is_circle_plus, false);
  v_limit int := case when coalesce(new.is_circle_plus, false) then 32 else 7 end;
  v_check_max boolean := false;
begin
  if auth.uid() is null then
    return new; -- SQL Editor / service role
  end if;

  if tg_op = 'INSERT' then
    v_check_max := true;
  elsif new.max_participants is distinct from old.max_participants then
    v_check_max := new.max_participants > coalesce(old.max_participants, 0);
  end if;

  if v_check_max and new.max_participants is not null and new.max_participants > v_limit then
    raise exception 'Maksimal % orang untuk %.', v_limit, case when v_plus then 'Circle+' else 'Circle' end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_b_guard_circle_limits on public.circles;
create trigger trg_b_guard_circle_limits
  before insert or update on public.circles
  for each row execute function public.guard_circle_limits();

-- ================= 2) CHECK-IN: sampai ditandai selesai (maks 24 jam) =================
drop policy if exists "members_update_own_checkin" on circle_members;
create policy "members_update_own_checkin" on circle_members for update using (
  auth.uid() = user_id
  and exists (
    select 1 from circles c
    where c.id = circle_members.circle_id
      and c.status = 'active'
      and now() >= c.event_date
      and now() <= c.event_date + interval '24 hours'
  )
);

-- ================= 3) BUANG JAM SELESAI =================
-- (setelah policy check-in diganti, karena policy lama dari 0040 bergantung pada kolom ini)
alter table public.circles drop column if exists event_end_date;

-- ================= 4) PENGINGAT HOST =================
alter table public.circles add column if not exists finish_reminded_at timestamptz;

-- Circle masih 'active' dan hari acara (WIB) sudah lewat -> kirim 1x notif ke host.
-- Baru dikirim mulai jam 08.00 WIB supaya tidak masuk tengah malam.
create or replace function public.remind_unfinished_circles()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  if extract(hour from (now() at time zone 'Asia/Jakarta')) < 8 then
    return;
  end if;

  for r in
    select id, name, created_by
    from public.circles
    where status = 'active'
      and finish_reminded_at is null
      and created_by is not null
      and event_date < now()
      and (event_date at time zone 'Asia/Jakarta')::date < (now() at time zone 'Asia/Jakarta')::date
  loop
    update public.circles set finish_reminded_at = now() where id = r.id;
    insert into public.notifications (user_id, circle_id, type, message)
    values (
      r.created_by, r.id, 'circle_finish_reminder',
      'Circle "' || r.name || '" belum kamu tandai selesai. Buka circle lalu tekan "Tandai Selesai" supaya status & check-in anggota tercatat.'
    );
  end loop;
end;
$$;
revoke all on function public.remind_unfinished_circles() from public, anon;
grant execute on function public.remind_unfinished_circles() to authenticated, service_role;

-- mark_completed_circles tidak lagi menyelesaikan circle. Dipertahankan sebagai pembungkus
-- supaya client/cron lama yang masih memanggilnya tidak error.
create or replace function public.mark_completed_circles()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.remind_unfinished_circles();
end;
$$;
revoke all on function public.mark_completed_circles() from public, anon;
grant execute on function public.mark_completed_circles() to authenticated, service_role;

-- Jadwal pg_cron: ganti job lama (tiap 5 menit, auto-selesai) dengan job pengingat tiap jam.
-- Kalau pg_cron tidak aktif, hanya NOTICE; app tetap memanggil remind_unfinished_circles saat notif dibuka.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname in ('mark-completed-circles', 'remind-unfinished-circles');
  perform cron.schedule('remind-unfinished-circles', '5 * * * *', 'select public.remind_unfinished_circles()');
exception when others then
  raise notice 'pg_cron tidak aktif (%). Aktifkan di Dashboard > Database > Extensions > pg_cron, lalu jalankan ulang blok ini.', sqlerrm;
end $$;
