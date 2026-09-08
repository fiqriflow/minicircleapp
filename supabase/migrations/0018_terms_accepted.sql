-- Jalankan sekali di Supabase SQL Editor
alter table profiles add column if not exists terms_accepted_at timestamptz;
