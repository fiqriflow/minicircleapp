-- Jalankan sekali di Supabase SQL Editor (setelah 0032)
-- Fix hasil audit:
--  1) Host bisa bayar circle biasa (-10) lalu ubah is_circle_plus=true (bypass biaya 100)
--  2) Host bisa tandai 'completed' SEBELUM acara mulai -> semua member kena penalti no-show
--  3) Function security definer masih bisa dipanggil anon (default PUBLIC execute)
--  4) User diblokir/suspend masih bisa upload ke storage

-- ================= 1+2) GUARD UPDATE CIRCLES =================
create or replace function public.guard_circle_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if not public.is_super_admin_caller() then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- tipe circle ditentukan saat dibuat (biaya energy dipotong saat INSERT)
    new.is_circle_plus := old.is_circle_plus;

    -- 'completed' dari host hanya boleh setelah acara dimulai
    if new.status = 'completed' and old.status is distinct from 'completed'
       and new.event_date > now() then
      raise exception 'Circle baru bisa ditandai selesai setelah acara dimulai. Pakai Batalkan kalau acara tidak jadi.';
    end if;
  end if;
  return new;
end;
$$;

-- ================= 3) TUTUP EXECUTE UNTUK ANON/PUBLIC =================
revoke all on function public.mark_completed_circles() from public, anon;
grant execute on function public.mark_completed_circles() to authenticated;

revoke all on function public.get_my_energy() from public, anon;
grant execute on function public.get_my_energy() to authenticated;

-- function baru ke depan: default tidak terbuka untuk anon/public
alter default privileges in schema public revoke execute on functions from public, anon;

-- ================= 4) STORAGE: AKUN DIBLOKIR TIDAK BOLEH UPLOAD =================
drop policy if exists "blocked_no_upload" on storage.objects;
create policy "blocked_no_upload" on storage.objects
  as restrictive for insert to authenticated
  with check (not public.is_account_blocked());
