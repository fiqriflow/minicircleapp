# Mincle

Aplikasi web/PWA untuk membentuk circle (tim kecil) beraktivitas bareng: Gowes, Jalan Santai, Jogging, Kulineran, Ngopi, Explore Alam, Motoran, dll.

Stack: Next.js 16 (App Router) + React 19 + Tailwind 3 + Supabase + Vercel. Font: Nunito (self-host via `next/font`).

## Setup

1. **Supabase**
   - Buat project di supabase.com
   - SQL Editor → jalankan semua file di `supabase/migrations/` **urut dari 0000 sampai 0064**. Detail: `supabase/README.md`
   - Authentication → Providers → aktifkan **Google** (Client ID/Secret dari Google Cloud Console)
   - Authentication → URL Configuration → Redirect URL: `https://DOMAIN_KAMU/auth/callback` (dan `http://localhost:3000/auth/callback` untuk dev)
   - Jadikan 1 user super admin: `update profiles set is_super_admin = true where id = 'USER_UUID';`

2. **Local dev**
   ```bash
   cp .env.local.example .env.local   # isi semua variabel (lihat file contoh)
   npm install
   npm run dev
   ```

3. **Deploy ke Vercel**
   - Import repo, set env yang sama dengan `.env.local.example`
   - `CRON_SECRET` wajib diisi (dipakai cron `/api/keepalive`, jadwal di `vercel.json`)
   - Update Redirect URL Supabase ke domain produksi

## Struktur halaman
- `/login` — Google SSO · `/onboarding` — lengkapi profil
- `/` — Beranda · `/explore` (+ `/explore/categories`) — cari circle
- `/my-circle` — circle yang dihost / diikuti / selesai
- `/circle/[id]` — detail circle · `/join/[code]` — gabung via kode undangan
- `/profile` — menu Akun, subhalaman: `data-user`, `energi`, `statistik`, `verifikasi`, `masukan`, `faq`, `kebijakan-privasi`, `panduan-komunitas`, `syarat-ketentuan`, `tentang-kami`
- `/admin/*` — khusus super admin: `dashboard`, `player`, `circle`, `verifikasi`, `laporan`, `masukan`, `energy`, `log`, `avatar`, `appearance`, `settings`
- `/maintenance`, `/akun-dinonaktifkan`, `/pendaftaran-ditutup`, `/coming-soon`
- API: `/api/keepalive`, `/api/push/{send,subscribe,unsubscribe}`, `/api/admin/hard-delete-user`

## Struktur folder
- `app/` — halaman & route API
- `components/` — `layout/` (shell, bottom nav, splash, notifikasi, energy), `home/`, `circle/`, `profile/`, `admin/`, `ui/`, `icons/`
- `lib/` — helper (energy, settings, push, lokasi, status circle, dll) dan `supabase/`
- `supabase/migrations/` — semua SQL, bernomor urut
- `proxy.ts` — auth gate, maintenance, suspend, onboarding, CSP nonce

## Sistem energy
Saldo kredit. Angka di `lib/energy.ts` harus sama dengan migration (DB yang menegakkan).
- Akun baru 1000 · bonus harian +100 (00.00 WIB, menumpuk)
- Join circle -10 · buat circle -50 · buat circle plus -100 · tidak check-in -10
- Riwayat tercatat di `energy_ledger` (migration 0062)

## UI (gaya Duolingo)
- Tombol utama `bg-primary` otomatis 3D "chunky" (lihat `app/globals.css`); tidak perlu class tambahan
- Kartu: class `card-chunk` (garis 2px, bawah 4px, turun saat ditekan). Efek tekan ringan: class `press`
- Bobot font di-remap (`medium` 600, `semibold` 700, `bold` 800) di `tailwind.config.ts`
- Radius tombol default 12px (`rounded-xl`)

## Kecepatan pindah halaman
- Tab bottom nav aktif langsung saat di-tap (state optimistik), tanpa tunggu halaman tujuan
- `app/template.tsx`: animasi masuk 160ms; tiap rute punya `loading.tsx` (skeleton instan)
- `proxy.ts` pakai `auth.getClaims()` (verifikasi JWT lokal), bukan `getUser()` yang round-trip ke Supabase Auth tiap navigasi
- Splash screen dipersingkat (~1,1 detik, sekali per sesi)

## Catatan
- CSP nonce diatur di `proxy.ts`; `CSP_REPORT_ONLY=1` untuk mode tes (tidak memblokir)
- Chat circle bisa ditingkatkan pakai `supabase.channel()` supaya auto-update tanpa reload

## Changelog
- **UI Duolingo + navigasi cepat**: font Nunito, tombol/kartu chunky, bottom nav gaya Duolingo, transisi halaman cepat, skeleton per rute, `getClaims()` di proxy, splash lebih singkat
