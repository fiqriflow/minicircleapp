-- Jalankan sekali di Supabase SQL Editor (setelah 0048)
-- Fix Supabase Advisor (CRITICAL):
--  - "Exposed Auth Users": view public.admin_player_view membaca auth.users & ada di schema public
--  - "Security Definer View": view jalan sebagai owner (bypass RLS)
-- Solusi: view dipindah ke schema `private` (tidak diekspos PostgREST) dan diakses
-- lewat RPC admin_get_players() yang menolak non-super-admin.
--
-- DEPLOY KODE (admin/player, admin/energy, admin/circle) BERSAMAAN dengan migration ini:
-- kode lama memanggil view yang dihapus di bawah.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

drop view if exists private.admin_player_view;
create view private.admin_player_view as
select p.*, u.email::text as email
from public.profiles p
join auth.users u on u.id = p.id;

revoke all on private.admin_player_view from public, anon, authenticated;

create or replace function public.admin_get_players()
returns setof private.admin_player_view
language plpgsql stable security definer set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_super_admin_caller() then
    raise exception 'Bukan super admin';
  end if;
  return query select * from private.admin_player_view;
end;
$$;
revoke all on function public.admin_get_players() from public, anon;
grant execute on function public.admin_get_players() to authenticated;

-- view lama (public) dihapus
drop view if exists public.admin_player_view;

-- CATATAN: p.* di-freeze saat view dibuat. Kalau nanti ada kolom baru di profiles yang perlu
-- tampil di admin: drop view private.admin_player_view lalu create ulang (function ikut valid
-- selama nama view sama; kalau error, drop function lalu buat ulang).
