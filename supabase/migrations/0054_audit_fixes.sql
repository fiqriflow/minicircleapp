-- Jalankan sekali di Supabase SQL Editor (setelah 0053)
-- Fix audit:
--  1) Status circle terkunci: hanya active -> completed/cancelled (tidak bisa dibalik / ditukar via API)
--  2) Check-in member dibuka sejak "Tandai Mulai" (bisa sampai 2 jam sebelum acara), bukan hanya setelah jam acara
--  3) Batal join (hapus baris sendiri) hanya sebelum circle dimulai; permintaan pending boleh dibatalkan kapan saja

-- ================= 1) KUNCI TRANSISI STATUS (versi lengkap dari 0034 + kunci status) =================
create or replace function public.guard_circle_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if not public.is_super_admin_caller() then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.is_circle_plus := old.is_circle_plus; -- biaya energy dipotong saat INSERT

    -- status: satu arah. active -> completed | cancelled. Selesai/dibatalkan final.
    -- (mencegah penalti no-show berulang & notif batal berulang)
    if new.status is distinct from old.status then
      if old.status is distinct from 'active' then
        raise exception 'Circle yang sudah selesai atau dibatalkan tidak bisa diubah statusnya.';
      elsif new.status not in ('completed', 'cancelled') then
        raise exception 'Status circle tidak valid.';
      end if;
    end if;

    -- started_at: sekali set, dicap waktu server, maksimal 2 jam sebelum acara
    if new.started_at is distinct from old.started_at then
      if old.started_at is not null or new.started_at is null then
        new.started_at := old.started_at;
      elsif old.status <> 'active' then
        raise exception 'Circle sudah tidak aktif.';
      elsif old.event_date - interval '2 hours' > now() then
        raise exception 'Tandai mulai baru bisa dilakukan maksimal 2 jam sebelum acara.';
      else
        new.started_at := now();
      end if;
    end if;

    -- jadwal tidak boleh dimundurkan ke masa lalu (akal-akal lewati aturan selesai)
    if new.event_date is distinct from old.event_date
       and new.event_date < now() and old.event_date >= now() then
      raise exception 'Tanggal acara tidak boleh di masa lalu.';
    end if;

    -- 'selesai' dari host: hanya setelah acara dimulai (jadwal lewat ATAU sudah ditandai mulai)
    if new.status = 'completed' and old.status is distinct from 'completed'
       and new.event_date > now() and new.started_at is null then
      raise exception 'Tandai mulai dulu sebelum menandai selesai. Pakai Batalkan kalau acara tidak jadi.';
    end if;
  end if;
  return new;
end;
$$;

-- ================= 2) CHECK-IN DIBUKA SEJAK "TANDAI MULAI" =================
drop policy if exists "members_update_own_checkin" on circle_members;
create policy "members_update_own_checkin" on circle_members for update using (
  auth.uid() = user_id
  and exists (
    select 1 from circles c
    where c.id = circle_members.circle_id
      and c.status = 'active'
      and now() >= least(c.started_at, c.event_date) -- least() mengabaikan NULL
      and now() <= c.event_date + interval '24 hours'
  )
);

-- ================= 3) BATAL JOIN HANYA SEBELUM CIRCLE DIMULAI =================
-- Sebelumnya member bisa menghapus keanggotaannya kapan saja (lolos dari penalti no-show
-- dan bisa menghapus jejak kehadiran setelah circle selesai).
drop policy if exists "members_delete_own" on public.circle_members;
create policy "members_delete_own" on public.circle_members for delete using (
  auth.uid() = user_id
  and (
    status = 'pending'
    or exists (
      select 1 from public.circles c
      where c.id = circle_members.circle_id
        and (
          (c.status = 'active' and c.started_at is null and now() < c.event_date)
          or c.status = 'cancelled'
        )
    )
  )
);
