-- Jalankan di SQL Editor Supabase (setelah schema.sql)

-- Buat bucket public untuk avatar & cover circle
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('circle-covers', 'circle-covers', true)
on conflict (id) do nothing;

-- Semua orang boleh lihat (bucket public, tapi tetap perlu select policy)
create policy "avatars_select_public" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "covers_select_public" on storage.objects
  for select using (bucket_id = 'circle-covers');

-- User login boleh upload/replace avatar miliknya sendiri (folder = user_id)
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- User login (creator circle / admin) boleh upload cover circle
create policy "covers_insert_auth" on storage.objects
  for insert with check (
    bucket_id = 'circle-covers' and auth.uid() is not null
  );

create policy "covers_update_auth" on storage.objects
  for update using (
    bucket_id = 'circle-covers' and auth.uid() is not null
  );
