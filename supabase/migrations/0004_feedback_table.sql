-- Jalankan file ini sekali di Supabase SQL Editor
-- Menambahkan tabel feedback untuk fitur "Masukan" di menu Akun > Bantuan

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  message text not null,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- User hanya bisa insert punya sendiri (tetap simpan user_id walau anonim,
-- supaya bisa ditelusuri kalau perlu; anonimitas cuma disembunyikan di tampilan admin)
drop policy if exists "feedback_insert_own" on feedback;
create policy "feedback_insert_own" on feedback for insert with check (auth.uid() = user_id);

-- Hanya super admin yang bisa lihat semua feedback
drop policy if exists "feedback_select_admin" on feedback;
create policy "feedback_select_admin" on feedback for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);
