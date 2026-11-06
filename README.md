# Mincle

Aplikasi web/PWA untuk membentuk circle (tim kecil) beraktivitas bareng: Gowes, Jalan Santai, Jogging, Renang, Explore Alam, Motoran, dll.

Stack: Next.js 16 (App Router) + React 19 + Tailwind 3 + Supabase + Vercel. Font: Nunito (self-host via `next/font`).

## Setup

1. **Supabase**
   - Buat project di supabase.com
   - SQL Editor → jalankan semua file di `supabase/migrations/` **urut dari 0000 sampai 0068**. Detail: `supabase/README.md`
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
- `/landing` — landing page publik (tanpa login)
- `/notifications` — halaman notifikasi (lonceng di header Beranda membuka halaman ini)
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
- Akun baru 1000 · reset mingguan: tiap Senin 00.00 WIB saldo di-set jadi 1000 (sisa lama hangus, tidak menumpuk)
- Join circle -100 · buat circle -100 · buat circle plus -200 · pelanggaran (tidak check-in) -50
- Riwayat tercatat di `energy_ledger` (migration 0062)

## UI (gaya Duolingo)
Semua gaya global ada di `app/globals.css`; halaman baru otomatis ikut tanpa class tambahan.
- Tombol utama `button.bg-primary` / `a.bg-primary` → 3D "chunky" (bayangan 4px, 2px untuk `text-xs`, turun saat ditekan)
- Tombol outline `button.border` → garis 2px, bawah 4px
- Kartu/panel `rounded-2xl border` → garis 2px, bawah 4px. Input/textarea/select `border` → garis 2px, abu muda, fokus oranye
- Kelas bantu: `card-chunk` (kartu yang bisa diklik), `press` (efek tekan ringan), `btn-flat` (opt-out dari gaya 3D, mis. sidebar admin)
- Tab: kotak bergaris (aktif = oranye muda). Bottom nav: tab aktif berkotak oranye
- Bobot font di-remap (`medium` 600, `semibold` 700, `bold` 800) di `tailwind.config.ts`; font Nunito
- Radius tombol default 12px (`rounded-xl`). Toast (sonner) ikut gaya kartu tebal

## Kecepatan pindah halaman
- Tab bottom nav aktif langsung saat di-tap (state optimistik), tanpa tunggu halaman tujuan
- `app/template.tsx`: animasi masuk 160ms; tiap rute punya `loading.tsx` (skeleton instan)
- `proxy.ts` pakai `auth.getClaims()` (verifikasi JWT lokal), bukan `getUser()` yang round-trip ke Supabase Auth tiap navigasi
- Splash screen dipersingkat (~1,1 detik, sekali per sesi)

## Optimistic UI
Helper: `lib/optimistic.ts` → `optimistic({ apply, run, onSuccess, onError, onSettled })`.
`apply` mengubah state SEKARANG dan mengembalikan fungsi rollback; `run` mengirim ke server di belakang layar.
Gagal/error jaringan → rollback otomatis + toast. `onSettled` dipakai untuk sinkron ulang dari server (`load()`).
Pola: simpan nilai lama di `apply`, kembalikan fungsi yang memasangnya lagi. Item baru yang belum tersimpan pakai `tempId()`.

Sudah dipakai di:
- Detail circle: join, batal join (slot, line up, saldo energy langsung berubah), terima/tolak permintaan join, check-in, koreksi hadir, co host, kirim komentar (muncul redup lalu diganti data asli; teks dikembalikan ke kolom input kalau gagal), pengumuman (kirim & lepas pin), tandai mulai/status circle, toggle approval
- Saldo energy: `notifyEnergyChanged({ delta })` mengubah badge langsung; `notifyEnergyChanged()` tanpa argumen = baca ulang dari server
- Notifikasi: tandai dibaca, hapus satu, hapus semua; klik notifikasi pindah halaman dulu
- Profil: ganti avatar preset, upload foto (pratinjau lokal), simpan profil
- Masukan: langsung tampil "Terima kasih", form dipulihkan kalau gagal
- Toggle notifikasi push (mematikan). Menyalakan sengaja tidak optimistic karena butuh izin browser

## Catatan
- CSP nonce diatur di `proxy.ts`; `CSP_REPORT_ONLY=1` untuk mode tes (tidak memblokir)
- Chat circle bisa ditingkatkan pakai `supabase.channel()` supaya auto-update tanpa reload

## Changelog
- **Landing page publik `/landing`**: hero, aktivitas, cara kerja, kenapa Mincle, FAQ, CTA ke `/login`. Bisa dibuka tanpa login (diperlakukan seperti halaman kebijakan di `proxy.ts`), tanpa BottomNav (`AppShell`). Halaman login punya tautan "Kenalan dulu sama Mincle →". Link circle yang dibagikan tetap wajib login (tidak ada preview publik)
- **Wizard Buat/Edit Circle: langkah Review** di akhir (ringkasan per grup + tombol "Ubah" yang melompat ke langkahnya, info biaya energy) sebelum Simpan/Buat Circle
- **Kick peserta + opsi check-in** (migration 0068): host & co host bisa "Keluarkan" peserta di tab Line Up sebelum circle dimulai (RPC `kick_member`, energy join 100 dikembalikan, peserta dapat notifikasi; co host tidak bisa mengeluarkan host/co host lain). Setting circle baru **"Pakai check-in peserta"** (`circles.require_checkin`, default aktif, terkunci setelah circle dimulai): kalau dimatikan tidak ada tombol check-in/koreksi hadir, tidak ada penalti, dan statistik menganggap semua peserta hadir. **Jalankan 0068 SEBELUM deploy kode** (kode membaca kolom baru)
- **Onboarding keyboard-aware**: tinggi layar mengikuti `visualViewport`, isi langkah scroll sendiri, input/select yang difokus otomatis dibawa ke tengah (tidak tertutup keyboard), header progress & tombol Lanjut/Kembali tetap terlihat di atas keyboard, ilustrasi bawah disembunyikan saat keyboard terbuka; Enter di Nama Lengkap pindah ke Nama Panggilan, Enter di field terakhir menutup keyboard
- **Buat/Edit Circle jadi wizard per langkah (gaya Duolingo)**: progress bar + tombol Lanjut/Kembali. Circle: 1 Dasar (nama, grup, aktivitas berupa kartu) → 2 Lokasi → 3 Waktu → 4 Peserta & rundown. Circle+ ditambah 5 Tampilan & akses (cover, private, invite link) → 6 Aturan join. Validasi per langkah; validasi penuh tetap di simpan (lompat ke langkah yang bermasalah). Logika simpan tidak berubah
- **Privasi profil (penuh)** (migration 0066 + 0067): gender/Instagram/kota hanya terbaca sesama circle (`rpc get_member_profile`); energy, tgl onboarding, dll tertutup (profil sendiri lewat `get_my_profile`); admin lewat `admin_profile_stats` & `admin_verified_profiles`. **Urutan deploy: jalankan 0066 → deploy kode → jalankan 0067.** Juga: `.gitignore`, guard `createAdminClient` hanya di server
- **Kategori, energy mingguan, halaman notifikasi** (migration 0065): kategori Kulineran & Ngopi dihapus dari pilihan, ditambah Renang (circle lama berkategori Kulineran/Ngopi tetap tersimpan, hanya muncul di filter "Semua"); energy di-reset ke 1000 tiap Senin 00.00 WIB, biaya join -100 / buat -100 / plus -200 / pelanggaran -50; notifikasi pindah dari dropdown ke halaman `/notifications` (filter Semua/Belum dibaca, tandai dibaca, hapus), lonceng tinggal badge
- **Duolingo ke seluruh app + optimistic UI**: gaya global tombol/kartu/input/tab/toggle/toast, `lib/optimistic.ts`, optimistic di circle, notifikasi, profil, masukan, energy badge
- **UI Duolingo + navigasi cepat**: font Nunito, tombol/kartu chunky, bottom nav gaya Duolingo, transisi halaman cepat, skeleton per rute, `getClaims()` di proxy, splash lebih singkat
