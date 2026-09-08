-- Jalankan sekali di Supabase SQL Editor
-- Fix: admin_player_view dibuat dengan "select p.*" SEBELUM kolom is_banned/suspended_until
-- ditambahkan ke tabel profiles. Di Postgres, p.* di view di-freeze saat CREATE, jadi kolom
-- baru gak otomatis kebawa sampai view-nya di-recreate. Jalankan ini untuk refresh.

drop view if exists public.admin_player_view;

create view public.admin_player_view as
select p.*, u.email
from public.profiles p
join auth.users u on u.id = p.id
where exists (
  select 1 from public.profiles me where me.id = auth.uid() and me.is_super_admin
);

grant select on public.admin_player_view to authenticated;
