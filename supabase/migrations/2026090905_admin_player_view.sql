-- Jalankan sekali di Supabase SQL Editor
-- View untuk halaman Admin > Player: gabungkan profiles + email dari auth.users
-- Hanya mengembalikan baris kalau yang query adalah super admin (dicek via subquery),
-- selain itu hasilnya kosong. View dibuat sebagai owner (postgres) sehingga bisa
-- membaca auth.users walau role "authenticated" tidak punya akses langsung ke situ.

create or replace view public.admin_player_view as
select p.*, u.email
from public.profiles p
join auth.users u on u.id = p.id
where exists (
  select 1 from public.profiles me where me.id = auth.uid() and me.is_super_admin
);

grant select on public.admin_player_view to authenticated;
