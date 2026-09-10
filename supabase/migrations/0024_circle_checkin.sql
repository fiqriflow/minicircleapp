-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Check-in kehadiran member circle.
-- Mekanisme: member tap sendiri "Check-in" pas circle lagi berlangsung
-- (event_date s/d +3 jam, samain sama logic getCircleDisplayStatus di
-- lib/circleStatus.ts), host bisa koreksi/override kapan aja termasuk
-- setelah circle selesai (pakai policy members_update_host yang udah ada,
-- gak dibatasi waktu).

-- 1) Kolom checkin di circle_members
alter table circle_members add column if not exists checked_in boolean not null default false;
alter table circle_members add column if not exists checked_in_at timestamptz;

-- 2) Policy: member boleh update BARIS SENDIRI, tapi hanya selama circle
--    berstatus 'active' dan waktu sekarang ada di window berlangsung
--    (event_date s/d +3 jam). Host override pakai policy members_update_host
--    yang sudah ada sebelumnya (tanpa batas waktu, jadi tetap bisa dipakai
--    setelah circle selesai).
drop policy if exists "members_update_own_checkin" on circle_members;
create policy "members_update_own_checkin" on circle_members for update using (
  auth.uid() = user_id
  and exists (
    select 1 from circles c
    where c.id = circle_members.circle_id
      and c.status = 'active'
      and now() >= c.event_date
      and now() <= c.event_date + interval '3 hours'
  )
);
