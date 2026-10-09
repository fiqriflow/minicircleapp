-- Jalankan sekali di Supabase SQL Editor (setelah 0054)
--  1) Usia minimum 17 tahun, dicek di DB (bukan hanya di form onboarding)
--  2) Samakan nama kota "Solo" & "Surakarta" -> "Surakarta (Solo)"
--     (notifikasi slot & filter lokasi mencocokkan nama kota persis)

-- ================= 1) USIA MINIMUM 17 TAHUN =================
-- Hanya dicek saat tanggal lahir DIISI/DIUBAH oleh user biasa. User lama yang sudah punya
-- tanggal lahir tidak terpengaruh. Super admin & service role (SQL Editor) bebas.
create or replace function public.guard_profile_min_age()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.birth_date is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.birth_date is not distinct from old.birth_date then
    return new;
  end if;
  if public.is_super_admin_caller() then
    return new;
  end if;

  if new.birth_date < date '1920-01-01' or new.birth_date > v_today then
    raise exception 'Tanggal lahir tidak valid.';
  end if;
  if new.birth_date > (v_today - interval '17 years')::date then
    raise exception 'Mincle khusus pengguna berusia minimal 17 tahun.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_min_age on public.profiles;
create trigger guard_profile_min_age
  before insert or update on public.profiles
  for each row execute function public.guard_profile_min_age();

-- ================= 2) SOLO / SURAKARTA =================
update public.profiles set location = 'Surakarta (Solo)' where location in ('Solo', 'Surakarta');
update public.circles  set city     = 'Surakarta (Solo)' where city     in ('Solo', 'Surakarta');
