-- Jalankan sekali di Supabase SQL Editor
-- Mengaktifkan fitur "Hapus Akun" milik sendiri (soft delete, tidak menyentuh auth.users)

-- 1) User boleh hapus baris profiles miliknya sendiri
drop policy if exists "profiles_delete_self" on profiles;
create policy "profiles_delete_self" on profiles for delete using (
  auth.uid() = id
);

-- 2) User boleh hapus file avatar miliknya sendiri di storage
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
