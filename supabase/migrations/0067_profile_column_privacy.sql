-- Jalankan sekali di Supabase SQL Editor (setelah 0066 DAN setelah kode baru ter-deploy)
-- Tahap 2: cabut hak baca kolom pribadi profil dari semua user login.
--   Terbatas (sesama circle, via rpc get_member_profile): gender, instagram, location
--   Privat (hanya diri sendiri via get_my_profile / admin via RPC): energy, energy_reset_at,
--     terms_accepted_at, onboarding_completed, verified_at
--   Sudah tersembunyi sejak 0028/0036: birth_date, lat, lng, suspension_reason, is_super_admin, is_banned, suspended_until
-- Tetap terbaca publik: id, full_name, nickname, username, avatar_url, categories, created_at, is_verified
--
-- Pengaman: kalau masih ada policy / view yang membaca kolom ini langsung, migration DIBATALKAN
-- (tidak ada yang berubah) dan pesan error menyebut nama objeknya.

do $$
declare
  r record;
  v_cols constant text := '\m(gender|instagram|location|energy|energy_reset_at|terms_accepted_at|onboarding_completed|verified_at)\M';
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where (coalesce(qual, '') ~* 'profiles' and coalesce(qual, '') ~* v_cols)
       or (coalesce(with_check, '') ~* 'profiles' and coalesce(with_check, '') ~* v_cols)
  loop
    raise exception 'Policy %.% (%) membaca kolom profil yang akan dicabut. Ubah dulu.',
      r.schemaname, r.tablename, r.policyname;
  end loop;

  for r in
    select schemaname, viewname
    from pg_views
    where schemaname = 'public'
      and definition ~* 'profiles' and definition ~* v_cols
  loop
    raise exception 'View %.% membaca kolom profil yang akan dicabut. Ubah dulu.', r.schemaname, r.viewname;
  end loop;
end $$;

revoke select (gender, instagram, location, energy, energy_reset_at, terms_accepted_at, onboarding_completed, verified_at)
  on public.profiles from authenticated;

-- Kolom baru di profiles yang aman dibaca publik: grant select (kolom) ... to authenticated (lihat 0028).
