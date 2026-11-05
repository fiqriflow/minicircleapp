-- Jalankan sekali di Supabase SQL Editor (setelah 0065) — AMAN dijalankan kapan saja (hanya menambah function).
-- Tahap 1 dari 2 untuk privasi profil. URUTAN DEPLOY:
--   1) jalankan 0066 ini
--   2) deploy kode baru (Vercel)
--   3) baru jalankan 0067 (mencabut hak baca kolom pribadi)
-- Kode baru jalan normal dengan atau tanpa 0067, jadi tidak ada layar yang rusak di antara langkah.

-- ================= GENDER / INSTAGRAM / KOTA ORANG LAIN =================
-- Hanya terbaca kalau: profil sendiri, super admin, atau satu circle (host / anggota joined) dengan kita.
create or replace function public.get_member_profile(p_user_id uuid)
returns table (id uuid, gender text, instagram text, location text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.gender, p.instagram, p.location
  from public.profiles p
  where p.id = p_user_id
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or public.is_super_admin_caller()
      or exists (
        select 1
        from public.circles c
        where (
                c.created_by = auth.uid()
                or exists (select 1 from public.circle_members a
                           where a.circle_id = c.id and a.user_id = auth.uid() and a.status = 'joined')
              )
          and (
                c.created_by = p.id
                or exists (select 1 from public.circle_members b
                           where b.circle_id = c.id and b.user_id = p.id and b.status = 'joined')
              )
      )
    );
$$;
revoke all on function public.get_member_profile(uuid) from public, anon;
grant execute on function public.get_member_profile(uuid) to authenticated;

-- ================= ADMIN: statistik & daftar terverifikasi =================
create or replace function public.admin_profile_stats()
returns table (id uuid, gender text, categories text[], location text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin_caller() then
    raise exception 'Bukan super admin';
  end if;
  return query select p.id, p.gender, p.categories, p.location, p.created_at from public.profiles p;
end;
$$;
revoke all on function public.admin_profile_stats() from public, anon;
grant execute on function public.admin_profile_stats() to authenticated;

create or replace function public.admin_verified_profiles()
returns table (id uuid, full_name text, nickname text, avatar_url text, instagram text, verified_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin_caller() then
    raise exception 'Bukan super admin';
  end if;
  return query
    select p.id, p.full_name, p.nickname, p.avatar_url, p.instagram, p.verified_at
    from public.profiles p
    where p.is_verified
    order by p.verified_at desc nulls last;
end;
$$;
revoke all on function public.admin_verified_profiles() from public, anon;
grant execute on function public.admin_verified_profiles() to authenticated;
