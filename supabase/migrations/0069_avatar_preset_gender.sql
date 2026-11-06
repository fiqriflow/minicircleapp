-- Jalankan sekali di Supabase SQL Editor (setelah 0068), SEBELUM deploy kode baru
-- Avatar preset dipisah per gender: 'male' (pria) / 'female' (wanita).
-- gender NULL = belum dikategorikan -> tetap tampil ke semua user sampai admin mengelompokkannya
-- (Admin > Avatar > tab "Belum dikategorikan", pakai "Pindahkan ke Pria/Wanita").
-- Di onboarding / data user, user hanya melihat avatar sesuai gendernya (+ yang belum dikategorikan).

alter table public.avatar_presets
  add column if not exists gender text check (gender in ('male', 'female'));

create index if not exists avatar_presets_gender_idx on public.avatar_presets (gender, sort_order);
