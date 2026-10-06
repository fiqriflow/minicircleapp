-- Jalankan sekali di Supabase SQL Editor (setelah 0043; butuh is_circle_cohost dari 0042)
-- Pengumuman host: pesan yang di-pin di circle + push ke semua member.
-- Yang boleh posting: host, co host, super admin. Hanya 1 pengumuman yang ter-pin (yang terbaru).

-- ================= 1) TABEL =================
create table if not exists public.circle_announcements (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  message text not null check (char_length(message) between 1 and 300),
  is_pinned boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists circle_announcements_circle_idx
  on public.circle_announcements (circle_id, created_at desc);

alter table public.circle_announcements enable row level security;

-- baca: member 'joined', host, super admin. Tulis: hanya lewat RPC di bawah.
drop policy if exists "announcements_select_members" on public.circle_announcements;
create policy "announcements_select_members" on public.circle_announcements
  for select to authenticated using (
    exists (
      select 1 from public.circle_members m
      where m.circle_id = circle_announcements.circle_id
        and m.user_id = (select auth.uid())
        and m.status = 'joined'
    )
    or exists (
      select 1 from public.circles c
      where c.id = circle_announcements.circle_id and c.created_by = (select auth.uid())
    )
    or (select public.is_super_admin_caller())
  );

revoke all on public.circle_announcements from anon, authenticated;
grant select on public.circle_announcements to authenticated;

-- ================= 2) POST PENGUMUMAN + PUSH KE SEMUA MEMBER =================
-- Push jalan lewat Database Webhook notifications (sama seperti notif lain): 1 notif per member.
create or replace function public.post_circle_announcement(p_circle_id uuid, p_message text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_circle record;
  v_msg text := trim(coalesce(p_message, ''));
  v_id uuid;
  v_author text;
begin
  if auth.uid() is null then
    raise exception 'Belum login';
  end if;
  if public.is_account_blocked() then
    raise exception 'Akun sedang dinonaktifkan.';
  end if;

  select id, name, created_by, status into v_circle
  from public.circles where id = p_circle_id;
  if v_circle.id is null then
    raise exception 'Circle tidak ditemukan';
  end if;

  if v_circle.created_by is distinct from auth.uid()
     and not public.is_circle_cohost(p_circle_id)
     and not public.is_super_admin_caller() then
    raise exception 'Cuma host / co host yang boleh bikin pengumuman';
  end if;

  if v_circle.status <> 'active' then
    raise exception 'Circle sudah tidak aktif';
  end if;

  if v_msg = '' or char_length(v_msg) > 300 then
    raise exception 'Pengumuman harus 1-300 karakter';
  end if;

  if (select count(*) from public.circle_announcements
      where circle_id = p_circle_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Terlalu banyak pengumuman, coba lagi nanti.';
  end if;

  update public.circle_announcements set is_pinned = false
  where circle_id = p_circle_id and is_pinned;

  insert into public.circle_announcements (circle_id, author_id, message)
  values (p_circle_id, auth.uid(), v_msg)
  returning id into v_id;

  select coalesce(nickname, full_name, 'Host') into v_author
  from public.profiles where id = auth.uid();

  insert into public.notifications (user_id, circle_id, actor_id, type, message)
  select m.user_id, p_circle_id, auth.uid(), 'circle_announcement',
         'Pengumuman dari ' || v_author || ' di "' || v_circle.name || '": ' || left(v_msg, 140)
  from public.circle_members m
  where m.circle_id = p_circle_id
    and m.status = 'joined'
    and m.user_id <> auth.uid();

  return v_id;
end;
$$;
revoke all on function public.post_circle_announcement(uuid, text) from public, anon;
grant execute on function public.post_circle_announcement(uuid, text) to authenticated;

-- ================= 3) LEPAS PIN =================
create or replace function public.unpin_circle_announcement(p_circle_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_host uuid;
begin
  if auth.uid() is null then
    raise exception 'Belum login';
  end if;
  if public.is_account_blocked() then
    raise exception 'Akun sedang dinonaktifkan.';
  end if;

  select created_by into v_host from public.circles where id = p_circle_id;

  if v_host is distinct from auth.uid()
     and not public.is_circle_cohost(p_circle_id)
     and not public.is_super_admin_caller() then
    raise exception 'Cuma host / co host yang boleh lepas pin';
  end if;

  update public.circle_announcements set is_pinned = false
  where circle_id = p_circle_id and is_pinned;
end;
$$;
revoke all on function public.unpin_circle_announcement(uuid) from public, anon;
grant execute on function public.unpin_circle_announcement(uuid) to authenticated;
