# Mabar Circle App

Stack: Next.js 14 (App Router) + Tailwind + Supabase + Vercel.

## Setup

1. **Supabase**
   - Buat project di supabase.com
   - Buka SQL Editor → jalankan semua file di `supabase/migrations/` **urut dari nomor terkecil ke terbesar** (0000, 0001, 0002, dst). Detail lihat `supabase/README.md`.
   - Authentication → Providers → aktifkan **Google**, isi Client ID/Secret dari Google Cloud Console
   - Authentication → URL Configuration → set Redirect URL: `https://DOMAIN_KAMU/auth/callback` (dan `http://localhost:3000/auth/callback` untuk dev)
   - Buat 1 user jadi super admin manual:
     `update profiles set is_super_admin = true where id = 'USER_UUID';`

2. **Local dev**
   ```bash
   cp .env.local.example .env.local
   # isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY (Project Settings > API)
   npm install
   npm run dev
   ```

3. **Deploy ke Vercel**
   - Import repo ke Vercel
   - Set environment variables yang sama (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Deploy
   - Update Redirect URL Supabase pakai domain Vercel

## Struktur Halaman
- `/login` — Google SSO
- `/` — Beranda (Hero + circle terdekat)
- `/explore` — filter lokasi & kategori
- `/my-circle` — circle aktif & selesai
- `/profile` — edit profil
- `/circle/[id]` — detail circle (Line Up, Chat, Join/Batal)
- `/admin/dashboard`, `/admin/player`, `/admin/circle` — khusus super admin (dilindungi middleware)

## Struktur `components/`
Dikelompokkan per fitur biar gampang dicari:
- `layout/` — shell aplikasi, bottom nav, splash screen, notifikasi
- `home/` — section-section halaman beranda
- `circle/` — kartu circle & semua modal terkait circle (buat, join, dll)
- `profile/` — modal terkait akun/profil
- `admin/` — komponen khusus dashboard admin
- `ui/` — komponen kecil yang dipakai lintas fitur (input lokasi, toggle, dll)
- `icons/` — kumpulan ikon custom

## Struktur `supabase/`
Semua SQL ada di `migrations/`, diberi nomor urut. Lihat `supabase/README.md`
untuk cara jalanin di project baru dan cara nambah migration baru.

## Catatan
- Realtime chat bisa ditingkatkan pakai `supabase.channel()` biar auto-update tanpa reload.
