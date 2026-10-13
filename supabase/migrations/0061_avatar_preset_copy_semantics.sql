-- Jalankan sekali di Supabase SQL Editor (setelah 0060)
-- Avatar preset sekarang DISALIN ke folder foto user sendiri saat dipilih (seperti foto upload).
-- Jadi menghapus / mengganti gambar preset TIDAK lagi mengubah foto profil user.
-- Catatan user lama yang masih memakai URL file preset langsung:
--   file preset tetap disimpan di storage selama masih dipakai profil (tidak dihapus), supaya foto mereka tidak rusak.

create or replace function public.admin_delete_avatar_preset(p_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_path text;
  v_url text;
  v_in_use boolean;
begin
  if not public.is_super_admin_caller() then
    raise exception 'Hanya super admin';
  end if;

  select storage_path, image_url into v_path, v_url
  from public.avatar_presets where id = p_id;
  if not found then
    return null;
  end if;

  select exists (
    select 1 from public.profiles
    where avatar_url is not null
      and split_part(avatar_url, '?', 1) = split_part(v_url, '?', 1)
  ) into v_in_use;

  delete from public.avatar_presets where id = p_id;

  -- Return path hanya jika file aman dihapus (tidak dipakai profil lama mana pun)
  return case when v_in_use then null else v_path end;
end;
$$;
revoke all on function public.admin_delete_avatar_preset(uuid) from public, anon;
grant execute on function public.admin_delete_avatar_preset(uuid) to authenticated;

create or replace function public.admin_replace_avatar_preset_image(p_id uuid, p_url text, p_path text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_old_path text;
  v_old_url text;
  v_in_use boolean;
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

  select exists (
    select 1 from public.profiles
    where avatar_url is not null
      and split_part(avatar_url, '?', 1) = split_part(v_old_url, '?', 1)
  ) into v_in_use;

  return case when v_in_use then null else v_old_path end;
end;
$$;
revoke all on function public.admin_replace_avatar_preset_image(uuid, text, text) from public, anon;
grant execute on function public.admin_replace_avatar_preset_image(uuid, text, text) to authenticated;
