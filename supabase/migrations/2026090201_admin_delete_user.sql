-- Jalankan file ini sekali di Supabase SQL Editor (project yang sudah jalan)
-- untuk memperbaiki: admin tidak bisa hapus user.
--
-- Penyebab: tabel profiles punya RLS aktif tapi belum ada policy DELETE,
-- dan created_by di circles belum punya ON DELETE action (bikin FK error
-- kalau user yang dihapus pernah bikin circle).

-- 1) Izinkan super admin menghapus baris profiles
drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin" on profiles for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);

-- 2) Kalau host circle dihapus, circle tetap ada tapi created_by jadi null
--    (bukan error / bukan ikut kehapus)
alter table circles drop constraint if exists circles_created_by_fkey;
alter table circles
  add constraint circles_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;
