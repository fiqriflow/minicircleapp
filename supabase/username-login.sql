-- Tambah kolom username (unik) di profiles
alter table profiles add column if not exists username text unique;

-- Fungsi untuk cari email berdasarkan username (dipakai saat login)
-- security definer supaya bisa baca tabel auth.users yang biasanya terproteksi
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
  limit 1;
$$;

-- Izinkan siapapun (termasuk yang belum login) memanggil fungsi ini
grant execute on function public.get_email_by_username(text) to anon, authenticated;
