-- Jalankan sekali di Supabase SQL Editor (setelah 0029)
-- Fix temuan SEDANG hasil audit:
--  1) user banned/suspend masih bisa tulis data lewat API langsung
--  2) join_answer terbaca semua user login
--  3) member 'pending' bisa baca & kirim komentar
--  4) SSRF push: endpoint subscription harus host push service resmi
--  5) hapus akun -> daftar ulang = energy/penalti ke-reset
--
-- CATATAN (poin 2): setelah ini select("*") ke circle_members dari client akan
-- ERROR. Sebutkan kolom satu per satu. Kolom baru yang boleh dibaca client:
--   grant select (nama_kolom) on public.circle_members to authenticated;

-- ================= 1) AKUN DIBLOKIR TIDAK BOLEH TULIS DATA =================
create or replace function public.is_account_blocked()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and not coalesce(p.is_super_admin, false)
      and (
        coalesce(p.is_banned, false)
        or (p.suspended_until is not null and p.suspended_until > now())
      )
  );
$$;
revoke all on function public.is_account_blocked() from public, anon;
grant execute on function public.is_account_blocked() to authenticated;

-- Policy RESTRICTIVE = digabung dengan AND ke policy yang sudah ada
do $$
declare
  t text;
begin
  foreach t in array array['circles', 'circle_members'] loop
    execute format('drop policy if exists "blocked_no_insert" on public.%I', t);
    execute format('drop policy if exists "blocked_no_update" on public.%I', t);
    execute format('drop policy if exists "blocked_no_delete" on public.%I', t);
    execute format('create policy "blocked_no_insert" on public.%I as restrictive for insert to authenticated with check (not public.is_account_blocked())', t);
    execute format('create policy "blocked_no_update" on public.%I as restrictive for update to authenticated using (not public.is_account_blocked()) with check (not public.is_account_blocked())', t);
    execute format('create policy "blocked_no_delete" on public.%I as restrictive for delete to authenticated using (not public.is_account_blocked())', t);
  end loop;

  foreach t in array array['circle_comments', 'feedback', 'reports'] loop
    execute format('drop policy if exists "blocked_no_insert" on public.%I', t);
    execute format('create policy "blocked_no_insert" on public.%I as restrictive for insert to authenticated with check (not public.is_account_blocked())', t);
  end loop;
end $$;

-- ================= 2) JOIN_ANSWER: HANYA HOST/ADMIN =================
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'circle_members'
    and column_name <> 'join_answer';

  execute 'revoke select on public.circle_members from anon, authenticated';
  execute format('grant select (%s) on public.circle_members to authenticated', cols);
end $$;

create or replace function public.get_circle_join_answers(p_circle_id uuid)
returns table(member_id uuid, join_answer text)
language sql stable security definer set search_path = public
as $$
  select m.id, m.join_answer
  from public.circle_members m
  join public.circles c on c.id = m.circle_id
  where m.circle_id = p_circle_id
    and (c.created_by = auth.uid() or public.is_super_admin_caller());
$$;
revoke all on function public.get_circle_join_answers(uuid) from public, anon;
grant execute on function public.get_circle_join_answers(uuid) to authenticated;

-- ================= 3) KOMENTAR: HANYA MEMBER 'joined' =================
drop policy if exists "comments_select_member" on public.circle_comments;
create policy "comments_select_member" on public.circle_comments
  for select using (
    exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_comments.circle_id
        and m.user_id = auth.uid()
        and m.status = 'joined'
    )
  );

drop policy if exists "comments_insert_member" on public.circle_comments;
create policy "comments_insert_member" on public.circle_comments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_comments.circle_id
        and m.user_id = auth.uid()
        and m.status = 'joined'
    )
    and exists (
      select 1 from public.circles c
      where c.id = circle_comments.circle_id and c.status = 'active'
    )
  );

-- ================= 4) PUSH: ALLOWLIST HOST ENDPOINT =================
-- Berlaku juga untuk insert langsung lewat PostgREST (bukan cuma lewat /api/push/subscribe).
-- NOT VALID = baris lama tidak dicek ulang; baris baru/ubahan wajib lolos.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_allowed;
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_allowed
  check (
    endpoint ~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)(:443)?/[^[:space:]@]*$'
  ) not valid;

-- ================= 5) ENERGY TIDAK BISA DI-RESET LEWAT HAPUS AKUN =================
-- Saat user hapus profil SENDIRI, energy terakhir disimpan; kalau daftar ulang
-- (profil baru), energy dipulihkan dari snapshot (reset mingguan tetap jalan normal).
create table if not exists public.profile_energy_snapshot (
  user_id uuid primary key,
  energy integer not null,
  energy_reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.profile_energy_snapshot enable row level security;
revoke all on public.profile_energy_snapshot from anon, authenticated;

create or replace function public.snapshot_energy_on_self_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- hanya hapus akun sendiri; hard-delete admin (service role) tidak menyimpan apa pun
  if auth.uid() is not null and old.id = auth.uid() then
    insert into public.profile_energy_snapshot (user_id, energy, energy_reset_at)
    values (old.id, old.energy, old.energy_reset_at)
    on conflict (user_id) do update
      set energy = excluded.energy,
          energy_reset_at = excluded.energy_reset_at,
          updated_at = now();
  end if;
  return old;
end;
$$;

-- nama "trg_b_" -> jalan SETELAH trg_a_guard_profile_delete (yang menolak hapus saat banned)
drop trigger if exists trg_b_snapshot_energy_on_delete on public.profiles;
create trigger trg_b_snapshot_energy_on_delete
  before delete on public.profiles
  for each row execute function public.snapshot_energy_on_self_delete();

-- hanya bisa baca snapshot MILIK SENDIRI (tanpa parameter -> tidak bisa intip user lain)
create or replace function public.energy_snapshot_for_me()
returns table(energy integer, energy_reset_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select s.energy, s.energy_reset_at
  from public.profile_energy_snapshot s
  where s.user_id = auth.uid();
$$;
revoke all on function public.energy_snapshot_for_me() from public, anon;
grant execute on function public.energy_snapshot_for_me() to authenticated;

create or replace function public.guard_profile_write()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_admin boolean;
  v_snap record;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- upsert ke baris yang sudah ada: biar guard UPDATE yang menangani
    if exists (select 1 from public.profiles where id = new.id) then
      return new;
    end if;
    new.is_super_admin := false;
    new.is_banned := false;
    new.suspended_until := null;
    new.suspension_reason := null;
    new.energy := 7;
    new.energy_reset_at := now();

    -- pernah hapus akun sendiri? pulihkan energy terakhir (bukan reset ke 7)
    select * into v_snap from public.energy_snapshot_for_me();
    if found then
      new.energy := v_snap.energy;
      new.energy_reset_at := v_snap.energy_reset_at;
    end if;
    return new;
  end if;

  v_admin := public.is_super_admin_caller();

  new.is_super_admin := old.is_super_admin;
  if not v_admin then
    new.is_banned := old.is_banned;
    new.suspended_until := old.suspended_until;
    new.suspension_reason := old.suspension_reason;
    new.energy := old.energy;
    new.energy_reset_at := old.energy_reset_at;
  end if;
  return new;
end;
$$;
