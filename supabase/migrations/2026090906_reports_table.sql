-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Report/Moderasi — user bisa laporkan Circle atau Pengguna lain,
-- Super Admin bisa meninjau & menindaklanjuti dari panel admin.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  target_type text not null check (target_type in ('circle', 'user')),
  target_circle_id uuid references circles(id) on delete cascade,
  target_user_id uuid references profiles(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_target_matches_type check (
    (target_type = 'circle' and target_circle_id is not null and target_user_id is null)
    or
    (target_type = 'user' and target_user_id is not null and target_circle_id is null)
  )
);

create index if not exists reports_status_idx on reports (status);
create index if not exists reports_target_circle_idx on reports (target_circle_id);
create index if not exists reports_target_user_idx on reports (target_user_id);

alter table reports enable row level security;

-- User cuma bisa bikin laporan atas namanya sendiri
drop policy if exists "reports_insert_own" on reports;
create policy "reports_insert_own" on reports for insert with check (auth.uid() = reporter_id);

-- User bisa lihat riwayat laporan yang dia buat sendiri; admin bisa lihat semua
drop policy if exists "reports_select_own_or_admin" on reports;
create policy "reports_select_own_or_admin" on reports for select using (
  auth.uid() = reporter_id
  or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);

-- Hanya admin yang bisa update status/tindak lanjut laporan
drop policy if exists "reports_update_admin" on reports;
create policy "reports_update_admin" on reports for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);

-- Hanya admin yang bisa hapus laporan
drop policy if exists "reports_delete_admin" on reports;
create policy "reports_delete_admin" on reports for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);
