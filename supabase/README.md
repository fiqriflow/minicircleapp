# Supabase Migrations

Semua SQL project ini sekarang ada di satu folder `migrations/`, diberi nomor urut
`0000`, `0001`, `0002`, dst. **Jalankan sesuai urutan nomor** — jangan diacak,
karena file belakangan bisa bergantung pada tabel/kolom dari file sebelumnya.

## Setup project baru (dari nol)

Di Supabase SQL Editor, jalankan seluruh isi `migrations/` **berurutan dari
0000 sampai nomor terbesar**, satu per satu (copy-paste isi file, Run, lanjut
ke file berikutnya).

```
0000_init_schema.sql          -> tabel inti (profiles, circles, dst)
0001_storage_buckets.sql      -> bucket avatar & cover circle
0002_username_login.sql       -> login pakai username
0003 ... 0019                 -> fitur & perbaikan, urut sesuai tanggal dibuat
```

Setelah semua jalan, jadikan 1 user sebagai super admin:

```sql
update profiles set is_super_admin = true where id = 'USER_UUID';
```

## Nambah migration baru

Buat file baru di `migrations/` dengan nomor lanjutan (misalnya kalau terakhir
`0019`, buat `0020_nama_fitur.sql`). Jangan edit file lama yang sudah pernah
dijalankan di production — selalu bikin file baru untuk perubahan baru.
