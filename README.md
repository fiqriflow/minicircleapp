# Mabar Circle App

Stack: Next.js 14 (App Router) + Tailwind + Supabase + Vercel.

## Setup

1. **Supabase**
   - Buat project di supabase.com
   - Buka SQL Editor → jalankan isi `supabase/schema.sql`
   - Jalankan juga `supabase/storage.sql` (untuk bucket foto profil & cover circle)
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

## Catatan
- Realtime chat bisa ditingkatkan pakai `supabase.channel()` biar auto-update tanpa reload.
