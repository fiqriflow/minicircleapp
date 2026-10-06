-- Jalankan sekali di Supabase SQL Editor (setelah 0035)
-- Fix audit (rendah):
--  1) Kolom is_super_admin, is_banned, suspended_until tidak lagi terbaca user lain.
--     Baca profil sendiri -> rpc get_my_profile. Policy admin dipindah ke is_super_admin_caller()
--     (policy lama membaca kolom itu langsung dan akan error setelah grant dicabut).
--  2) app_settings: anon hanya boleh baca key publik (maintenance & batas pendaftaran).
--
-- DEPLOY KODE (proxy.ts, app/profile/page.tsx, hard-delete-user) SEBELUM/BERSAMAAN dengan migration ini,
-- karena kode lama membaca kolom itu langsung dari tabel profiles.

-- ================= 1) POLICY ADMIN -> is_super_admin_caller() =================
alter policy "profiles_delete_admin"          on public.profiles      using (public.is_super_admin_caller());
alter policy "profiles_update_admin"          on public.profiles      using (public.is_super_admin_caller());
alter policy "circles_update_owner_or_admin"  on public.circles       using (auth.uid() = created_by or public.is_super_admin_caller());
alter policy "circles_delete_owner_or_admin"  on public.circles       using (auth.uid() = created_by or public.is_super_admin_caller());
alter policy "settings_upsert_admin"          on public.app_settings  with check (public.is_super_admin_caller());
alter policy "settings_update_admin"          on public.app_settings  using (public.is_super_admin_caller());
alter policy "feedback_select_admin"          on public.feedback      using (public.is_super_admin_caller());
alter policy "feedback_delete_admin"          on public.feedback      using (public.is_super_admin_caller());
alter policy "activity_log_select_admin"      on public.activity_log  using (public.is_super_admin_caller());
alter policy "activity_log_delete_admin"      on public.activity_log  using (public.is_super_admin_caller());
alter policy "reports_select_own_or_admin"    on public.reports       using (auth.uid() = reporter_id or public.is_super_admin_caller());
alter policy "reports_update_admin"           on public.reports       using (public.is_super_admin_caller());
alter policy "reports_delete_admin"           on public.reports       using (public.is_super_admin_caller());

-- Pengaman: kalau masih ada policy yang membaca kolom itu langsung, batalkan seluruh migration
-- (policy tsb akan error "permission denied for column" setelah REVOKE di bawah).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where coalesce(qual, '') ~ '(p|me)\.(is_super_admin|is_banned|suspended_until)'
       or coalesce(with_check, '') ~ '(p|me)\.(is_super_admin|is_banned|suspended_until)'
  loop
    raise exception 'Policy %.% (%) masih membaca kolom admin langsung. Ubah dulu ke is_super_admin_caller().',
      r.schemaname, r.tablename, r.policyname;
  end loop;
end $$;

-- ================= 2) SEMBUNYIKAN KOLOM ADMIN =================
revoke select (is_super_admin, is_banned, suspended_until) on public.profiles from authenticated;

-- ================= 3) APP_SETTINGS: ANON HANYA KEY PUBLIK =================
drop policy if exists "settings_select_all" on public.app_settings;
drop policy if exists "settings_select_authenticated" on public.app_settings;
drop policy if exists "settings_select_anon_public_keys" on public.app_settings;

create policy "settings_select_authenticated" on public.app_settings
  for select to authenticated using (true);

create policy "settings_select_anon_public_keys" on public.app_settings
  for select to anon
  using (key in ('maintenance_mode', 'registration_limit_enabled', 'registration_limit_count'));
