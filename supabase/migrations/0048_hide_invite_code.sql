-- Jalankan sekali di Supabase SQL Editor (setelah 0047)
-- Fix audit: invite_code ikut terbaca lewat select("*") pada circle publik.
--  1) Kolom invite_code tidak lagi bisa dibaca client (anon/authenticated).
--  2) Host / co-host / super admin ambil kode lewat rpc get_circle_invite_code.
--
-- DEPLOY KODE (lib/circleColumns.ts + halaman yang select circles) SEBELUM/BERSAMAAN
-- dengan migration ini, karena select("*") ke circles akan error "permission denied".
-- Catatan: kolom BARU di circles perlu: grant select (kolom) on public.circles to authenticated;

-- ================= 0) PENGAMAN =================
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where coalesce(qual, '') ~ 'invite_code' or coalesce(with_check, '') ~ 'invite_code'
  loop
    raise exception 'Policy %.% (%) masih membaca invite_code langsung. Ubah dulu.',
      r.schemaname, r.tablename, r.policyname;
  end loop;
end $$;

-- ================= 1) RPC KODE UNDANGAN =================
create or replace function public.get_circle_invite_code(p_circle_id uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_owner uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select invite_code, created_by into v_code, v_owner
  from public.circles where id = p_circle_id;
  if not found then
    return null;
  end if;

  if v_owner = v_uid
     or public.is_super_admin_caller()
     or public.is_circle_cohost(p_circle_id) then
    return v_code;
  end if;
  return null;
end;
$$;
revoke all on function public.get_circle_invite_code(uuid) from public, anon;
grant execute on function public.get_circle_invite_code(uuid) to authenticated;

-- ================= 2) SEMBUNYIKAN KOLOM =================
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'circles'
    and column_name <> 'invite_code';

  execute 'revoke select on public.circles from anon, authenticated';
  execute format('grant select (%s) on public.circles to authenticated', cols);
end $$;
