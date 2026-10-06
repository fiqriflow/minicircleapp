-- Jalankan sekali di Supabase SQL Editor (setelah 0038)
-- Avatar preset: admin CRUD (Admin > Avatar), user pilih saat onboarding.
--  1) tabel avatar_presets (RLS: user login baca yang aktif, admin full)
--  2) bucket public 'avatar-presets' (tulis hanya super admin)
--  3) RPC admin_delete_avatar_preset / admin_replace_avatar_preset_image
--     -> user yang sedang memakai preset ikut dibereskan (avatar di-null / dipindah ke gambar baru)

-- ================= 1) TABEL =================
create table if not exists public.avatar_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  image_url text not null,
  storage_path text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.avatar_presets enable row level security;

drop policy if exists "avatar_presets_select" on public.avatar_presets;
create policy "avatar_presets_select" on public.avatar_presets
  for select to authenticated
  using (is_active or (select public.is_super_admin_caller()));

drop policy if exists "avatar_presets_insert_admin" on public.avatar_presets;
create policy "avatar_presets_insert_admin" on public.avatar_presets
  for insert to authenticated
  with check ((select public.is_super_admin_caller()));

drop policy if exists "avatar_presets_update_admin" on public.avatar_presets;
create policy "avatar_presets_update_admin" on public.avatar_presets
  for update to authenticated
  using ((select public.is_super_admin_caller()))
  with check ((select public.is_super_admin_caller()));

drop policy if exists "avatar_presets_delete_admin" on public.avatar_presets;
create policy "avatar_presets_delete_admin" on public.avatar_presets
  for delete to authenticated
  using ((select public.is_super_admin_caller()));

create index if not exists avatar_presets_sort_idx on public.avatar_presets (sort_order, created_at);

-- ================= 2) STORAGE =================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar-presets', 'avatar-presets', true, 524288,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar_presets_obj_select" on storage.objects;
create policy "avatar_presets_obj_select" on storage.objects
  for select using (bucket_id = 'avatar-presets');

drop policy if exists "avatar_presets_obj_insert_admin" on storage.objects;
create policy "avatar_presets_obj_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatar-presets' and (select public.is_super_admin_caller()));

drop policy if exists "avatar_presets_obj_update_admin" on storage.objects;
create policy "avatar_presets_obj_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatar-presets' and (select public.is_super_admin_caller()))
  with check (bucket_id = 'avatar-presets' and (select public.is_super_admin_caller()));

drop policy if exists "avatar_presets_obj_delete_admin" on storage.objects;
create policy "avatar_presets_obj_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatar-presets' and (select public.is_super_admin_caller()));

-- ================= 3) RPC ADMIN =================
-- Hapus preset. User yang memakainya -> avatar_url di-null (kembali ke avatar default UI).
-- Return storage_path supaya client bisa hapus file-nya.
create or replace function public.admin_delete_avatar_preset(p_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_path text;
  v_url text;
begin
  if not public.is_super_admin_caller() then
    raise exception 'Hanya super admin';
  end if;

  select storage_path, image_url into v_path, v_url
  from public.avatar_presets where id = p_id;
  if not found then
    return null;
  end if;

  update public.profiles
  set avatar_url = null
  where avatar_url is not null
    and split_part(avatar_url, '?', 1) = split_part(v_url, '?', 1);

  delete from public.avatar_presets where id = p_id;
  return v_path;
end;
$$;
revoke all on function public.admin_delete_avatar_preset(uuid) from public, anon;
grant execute on function public.admin_delete_avatar_preset(uuid) to authenticated;

-- Ganti gambar preset. User yang memakai gambar lama dipindah ke gambar baru.
-- Return storage_path lama supaya client bisa hapus file lama.
create or replace function public.admin_replace_avatar_preset_image(p_id uuid, p_url text, p_path text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_old_path text;
  v_old_url text;
begin
  if not public.is_super_admin_caller() then
    raise exception 'Hanya super admin';
  end if;

  select storage_path, image_url into v_old_path, v_old_url
  from public.avatar_presets where id = p_id;
  if not found then
    raise exception 'Preset tidak ditemukan';
  end if;

  update public.avatar_presets
  set image_url = p_url, storage_path = p_path
  where id = p_id;

  update public.profiles
  set avatar_url = p_url
  where avatar_url is not null
    and split_part(avatar_url, '?', 1) = split_part(v_old_url, '?', 1);

  return v_old_path;
end;
$$;
revoke all on function public.admin_replace_avatar_preset_image(uuid, text, text) from public, anon;
grant execute on function public.admin_replace_avatar_preset_image(uuid, text, text) to authenticated;
