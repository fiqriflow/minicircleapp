-- Jalankan sekali di Supabase SQL Editor (setelah 0059)
-- Hapus filter peserta per generasi (Gen Z / Milenial / rentang tahun lahir).
-- Circle lama yang punya filter ini dibersihkan supaya tidak ada pembatasan tersembunyi saat join.
-- session_replication_role = replica: lewati trigger agar tidak ada notifikasi/validasi yang ikut jalan.

begin;
set local session_replication_role = replica;

update public.circles
   set join_birth_year_min = null,
       join_birth_year_max = null
 where join_birth_year_min is not null or join_birth_year_max is not null;

commit;
