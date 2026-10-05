-- Jalankan sekali di Supabase SQL Editor (setelah 0028)
-- FIX (tinggi): circle private bisa dimasuki tanpa kode undangan.
-- Penyebab: (1) circle_members terbaca semua user login -> circle_id private bocor,
--           (2) insert ke circle_members tidak cek privasi circle.
-- Solusi:   (1) member circle private hanya terlihat oleh yang berhak,
--           (2) insert langsung ke circle private DITOLAK; join lewat RPC
--               join_circle_by_invite (wajib kode undangan yang benar).

-- ================= 1) HELPER =================
create or replace function public.circle_is_private(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select coalesce(c.is_private, false) from public.circles c where c.id = p_circle_id), false);
$$;
revoke all on function public.circle_is_private(uuid) from public, anon;
grant execute on function public.circle_is_private(uuid) to authenticated;

-- security definer -> baca circles/circle_members tanpa kena RLS (hindari rekursi policy)
create or replace function public.circle_visible_to_me(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle_id
      and (
        not coalesce(c.is_private, false)
        or c.created_by = auth.uid()
        or public.is_super_admin_caller()
        or exists (
          select 1 from public.circle_members m
          where m.circle_id = c.id and m.user_id = auth.uid()
        )
      )
  );
$$;
revoke all on function public.circle_visible_to_me(uuid) from public, anon;
grant execute on function public.circle_visible_to_me(uuid) to authenticated;

-- ================= 2) SELECT circle_members: sembunyikan circle private =================
drop policy if exists "members_select_authenticated" on public.circle_members;
drop policy if exists "members_select_visible" on public.circle_members;
create policy "members_select_visible" on public.circle_members
  for select to authenticated
  using (public.circle_visible_to_me(circle_id));

-- ================= 3) TRIGGER: tolak insert langsung ke circle private =================
create or replace function public.guard_circle_member_write()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_host uuid;
  v_approval boolean;
  v_admin boolean;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  select m.created_by, m.requires_approval
    into v_host, v_approval
  from public.circle_meta(new.circle_id) m;

  v_admin := public.is_super_admin_caller();

  if tg_op = 'INSERT' then
    -- circle private: hanya host/admin yang boleh insert langsung.
    -- User lain wajib lewat RPC join_circle_by_invite (cek kode undangan).
    if public.circle_is_private(new.circle_id)
       and not v_admin
       and new.user_id is distinct from v_host then
      raise exception 'Circle private hanya bisa dimasuki lewat link undangan.';
    end if;

    -- circle butuh approval -> semua selain host/admin wajib mulai dari 'pending'
    if v_approval and not v_admin and new.user_id is distinct from v_host then
      new.status := 'pending';
    end if;
    new.checked_in := false;
    new.checked_in_at := null;
    new.energy_penalized := false;
    return new;
  end if;

  -- UPDATE: kolom identitas & penalti tidak boleh diubah lewat client
  new.circle_id := old.circle_id;
  new.user_id := old.user_id;
  new.join_answer := old.join_answer;
  new.joined_at := old.joined_at;
  new.energy_penalized := old.energy_penalized;

  -- hanya host/admin yang boleh ubah status (approve member)
  if not v_admin and v_host is distinct from auth.uid() then
    new.status := old.status;
  end if;
  return new;
end;
$$;

-- ================= 4) RPC: join lewat kode undangan =================
-- Jalan sebagai owner (security definer) -> trigger guard di atas di-skip,
-- jadi aturan approval/reset kolom diterapkan manual di sini.
create or replace function public.join_circle_by_invite(p_code text, p_answer text default null)
returns uuid
language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_circle public.circles%rowtype;
  v_prof record;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Belum login';
  end if;

  select is_banned, suspended_until into v_prof from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profil belum dibuat';
  end if;
  if coalesce(v_prof.is_banned, false)
     or (v_prof.suspended_until is not null and v_prof.suspended_until > now()) then
    raise exception 'Akun sedang dinonaktifkan.';
  end if;

  select * into v_circle from public.circles
  where invite_code = upper(trim(p_code))
  limit 1;
  if not found then
    raise exception 'Kode undangan tidak valid';
  end if;

  v_status := case
    when coalesce(v_circle.requires_approval, false)
         and v_uid is distinct from v_circle.created_by then 'pending'
    else 'joined'
  end;

  insert into public.circle_members
    (circle_id, user_id, status, join_answer, checked_in, checked_in_at, energy_penalized)
  values
    (v_circle.id, v_uid, v_status, left(p_answer, 1000), false, null, false)
  on conflict (circle_id, user_id) do nothing;

  return v_circle.id;
end;
$$;
revoke all on function public.join_circle_by_invite(text, text) from public, anon;
grant execute on function public.join_circle_by_invite(text, text) to authenticated;
