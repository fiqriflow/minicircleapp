-- Jalankan sekali di Supabase SQL Editor (setelah 0057)
-- FIX: join circle error "record \"new\" has no field \"created_by\"".
-- Penyebab: di 0045, CASE tg_table_name ... new.created_by ... new.user_id dikompilasi sebagai SATU
-- ekspresi SQL, jadi new.created_by tetap dicek saat trigger jalan di circle_members (tidak punya kolom itu).
-- Solusi: pisahkan jadi IF/ELSE sehingga hanya field yang sesuai tabel yang diakses.

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

  if tg_table_name = 'circles' then
    v_uid := new.created_by;
  else
    v_uid := new.user_id;
  end if;

  select (coalesce(trim(instagram), '') <> '' and coalesce(trim(avatar_url), '') <> '')
    into v_ok
  from public.profiles where id = v_uid;

  if not coalesce(v_ok, false) then
    raise exception 'Lengkapi foto profil & Instagram dulu (Profil > Data Diri).';
  end if;
  return new;
end;
$$;
