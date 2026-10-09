-- Jalankan sekali di Supabase SQL Editor (setelah 0056)
-- WAJIB dijalankan SEBELUM deploy kode (kode memilih & menulis kolom allow_late_join).
-- Opsi host "Izinkan join setelah mulai":
--   - default mati: join ditutup begitu jam mulai tiba ATAU host menekan "Tandai Mulai"
--   - aktif: orang baru masih bisa join sampai 3 jam setelah jam mulai (batas lama tetap berlaku)
-- Catatan: circle yang sedang berjalan saat migration ini dijalankan ikut default mati.

alter table public.circles add column if not exists allow_late_join boolean not null default false;
grant select (allow_late_join) on public.circles to authenticated; -- select kolom dibatasi sejak 0048

create or replace function public.guard_circle_member_join_active()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
  v_date timestamptz;
  v_started timestamptz;
  v_late boolean;
begin
  if auth.uid() is null or public.is_super_admin_caller() then
    return new;
  end if;

  select status, event_date, started_at, allow_late_join
    into v_status, v_date, v_started, v_late
  from public.circles where id = new.circle_id;

  if v_status is distinct from 'active' or v_date + interval '3 hours' < now() then
    raise exception 'Circle ini sudah tidak aktif.';
  end if;

  -- sudah dimulai (jam lewat / host tandai mulai) -> hanya boleh kalau host mengizinkan
  if not coalesce(v_late, false) and (v_started is not null or v_date <= now()) then
    raise exception 'Pendaftaran ditutup karena circle sudah dimulai.';
  end if;

  return new;
end;
$$;
