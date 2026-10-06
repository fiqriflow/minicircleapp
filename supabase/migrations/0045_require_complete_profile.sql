-- Jalankan sekali di Supabase SQL Editor (setelah 0044)
-- Foto profil + Instagram WAJIB untuk buat circle dan join circle (dicek di DB, bukan cuma di client).
-- Berlaku juga untuk join lewat RPC join_circle_by_invite. Super admin & SQL Editor/service role lolos.
-- Catatan: user lama yang belum isi akan diminta melengkapi dulu saat join/buat circle.

create or replace function public.require_complete_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid;
  v_ok boolean;
begin
  if auth.uid() is null or public.is_super_admin_caller() then
    return new;
  end if;

  v_uid := case tg_table_name when 'circles' then new.created_by else new.user_id end;

  select (coalesce(trim(instagram), '') <> '' and coalesce(trim(avatar_url), '') <> '')
    into v_ok
  from public.profiles where id = v_uid;

  if not coalesce(v_ok, false) then
    raise exception 'Lengkapi foto profil & Instagram dulu (Profil > Data Diri).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_b_require_complete_profile on public.circles;
create trigger trg_b_require_complete_profile
  before insert on public.circles
  for each row execute function public.require_complete_profile();

drop trigger if exists trg_b_require_complete_profile on public.circle_members;
create trigger trg_b_require_complete_profile
  before insert on public.circle_members
  for each row execute function public.require_complete_profile();
