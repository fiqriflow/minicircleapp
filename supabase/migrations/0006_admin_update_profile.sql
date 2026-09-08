-- Jalankan file ini sekali di Supabase SQL Editor
-- Fix: super admin gak bisa update profile user lain (RLS cuma izinkan update diri sendiri)

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);
