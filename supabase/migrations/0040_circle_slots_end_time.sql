-- Jalankan sekali di Supabase SQL Editor (setelah 0039)
--  1) Slot: Circle biasa maks 7 orang, Circle+ maks 32 orang (min tetap 3)
--  2) Jam selesai: kolom event_end_date (nullable agar circle lama tetap jalan;
--     kalau kosong dianggap event_date + 3 jam, sama seperti sebelumnya)
--  3) Check-in & auto-selesai sekarang mengikuti jam selesai

-- ================= 1) BATAS SLOT =================
-- constraint lama: max_participants between 3 and 20 -> diganti 3..32
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

-- ================= 2) JAM SELESAI =================
alter table public.circles add column if not exists event_end_date timestamptz;

-- ================= 3) GUARD: batas per tipe + validasi jam =================
-- Circle lama yang slotnya > 7 tetap aman: batas hanya dicek saat slot DINAIKKAN / circle baru.
create or replace function public.guard_circle_limits()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_plus boolean := coalesce(new.is_circle_plus, false);
  v_limit int := case when coalesce(new.is_circle_plus, false) then 32 else 7 end;
  v_check_max boolean := false;
  v_check_time boolean := false;
begin
  -- SQL Editor / service role lolos
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_check_max := true;
    v_check_time := true;
  else
    if new.max_participants is distinct from old.max_participants then
      v_check_max := new.max_participants > coalesce(old.max_participants, 0);
    end if;
    if new.event_end_date is distinct from old.event_end_date
       or new.event_date is distinct from old.event_date then
      v_check_time := true;
    end if;
  end if;

  if v_check_max and new.max_participants is not null and new.max_participants > v_limit then
    raise exception 'Maksimal % orang untuk %.', v_limit, case when v_plus then 'Circle+' else 'Circle' end;
  end if;

  if v_check_time and new.event_end_date is not null then
    if new.event_end_date <= new.event_date then
      raise exception 'Jam selesai harus setelah jam mulai.';
    end if;
    if new.event_end_date > new.event_date + interval '24 hours' then
      raise exception 'Durasi acara maksimal 24 jam.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_b_guard_circle_limits on public.circles;
create trigger trg_b_guard_circle_limits
  before insert or update on public.circles
  for each row execute function public.guard_circle_limits();

-- ================= 4) CHECK-IN MENGIKUTI JAM SELESAI =================
drop policy if exists "members_update_own_checkin" on circle_members;
create policy "members_update_own_checkin" on circle_members for update using (
  auth.uid() = user_id
  and exists (
    select 1 from circles c
    where c.id = circle_members.circle_id
      and c.status = 'active'
      and now() >= c.event_date
      and now() <= coalesce(c.event_end_date, c.event_date + interval '3 hours')
  )
);

-- ================= 5) AUTO-SELESAI MENGIKUTI JAM SELESAI =================
create or replace function public.mark_completed_circles()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id, name, created_by
    from public.circles
    where status = 'active'
      and event_date < now()  -- bantu index
      and coalesce(event_end_date, event_date + interval '3 hours') < now()
  loop
    update public.circles set status = 'completed' where id = r.id;
    if r.created_by is not null then
      insert into public.notifications (user_id, circle_id, type, message)
      values (r.created_by, r.id, 'circle_completed', 'Circle "' || r.name || '" sudah selesai (waktu sudah lewat).');
    end if;
  end loop;
end;
$$;
revoke all on function public.mark_completed_circles() from public, anon;
grant execute on function public.mark_completed_circles() to authenticated, service_role;
