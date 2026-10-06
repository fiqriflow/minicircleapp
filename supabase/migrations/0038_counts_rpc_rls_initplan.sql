-- Jalankan sekali di Supabase SQL Editor (setelah 0037)
-- Audit kecepatan tahap 2:
--  1) RPC get_joined_counts: hitung peserta per circle di DB (sebelumnya client menarik semua baris member).
--     Pakai SECURITY INVOKER -> RLS tetap berlaku (circle private tetap tersembunyi).
--  2) Bungkus is_super_admin_caller() / is_account_blocked() di policy dengan (select ...) agar
--     dievaluasi SEKALI per query (initplan), bukan per baris.

-- ================= 1) RPC HITUNG PESERTA =================
create or replace function public.get_joined_counts(p_circle_ids uuid[])
returns table(circle_id uuid, joined_count bigint)
language sql stable set search_path = public
as $$
  select m.circle_id, count(*)::bigint
  from public.circle_members m
  where m.circle_id = any(p_circle_ids)
    and m.status = 'joined'
  group by m.circle_id;
$$;
revoke all on function public.get_joined_counts(uuid[]) from public, anon;
grant execute on function public.get_joined_counts(uuid[]) to authenticated;

-- ================= 2) POLICY: INITPLAN =================
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
  v_pat constant text := '(public\.)?(is_super_admin_caller|is_account_blocked)\(\)';
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') ~ v_pat or coalesce(with_check, '') ~ v_pat)
      -- lewati yang sudah dibungkus (deparse: "( SELECT is_x() AS is_x)")
      and coalesce(qual, '') !~* 'select\s+(public\.)?(is_super_admin_caller|is_account_blocked)'
      and coalesce(with_check, '') !~* 'select\s+(public\.)?(is_super_admin_caller|is_account_blocked)'
  loop
    v_using := case when r.qual is null then null
                    else regexp_replace(r.qual, v_pat, '(select public.\2())', 'g') end;
    v_check := case when r.with_check is null then null
                    else regexp_replace(r.with_check, v_pat, '(select public.\2())', 'g') end;

    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_using is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
    n := n + 1;
  end loop;
  raise notice 'policy dibungkus initplan: %', n;
end $$;
