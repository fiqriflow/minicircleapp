-- Jalankan sekali di Supabase SQL Editor (setelah 0030)
-- Fix temuan RENDAH hasil audit:
--  1) rate limit tebak kode undangan (get_circle_by_invite & join_circle_by_invite)
--  2) check-in: waktu dicap server + hanya member 'joined'
--  3) circles: created_by tidak bisa dipindah lewat client

-- ================= 1) RATE LIMIT KODE UNDANGAN =================
-- Yang dihitung: percobaan GAGAL (kode tidak ditemukan). Maks 15 per 10 menit per user.
create table if not exists public.invite_miss_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists invite_miss_log_user_time
  on public.invite_miss_log (user_id, created_at desc);
alter table public.invite_miss_log enable row level security;
revoke all on public.invite_miss_log from anon, authenticated;

create or replace function public.invite_rate_limit_check()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.invite_miss_log
      where user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 15 then
    raise exception 'Terlalu banyak percobaan kode undangan, coba lagi beberapa menit lagi.';
  end if;
end;
$$;

create or replace function public.invite_rate_limit_log()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.invite_miss_log where created_at < now() - interval '1 day';
  insert into public.invite_miss_log (user_id) values (auth.uid());
end;
$$;

-- hanya dipanggil dari function security definer lain -> tidak perlu dibuka ke client
revoke all on function public.invite_rate_limit_check() from public, anon, authenticated;
revoke all on function public.invite_rate_limit_log() from public, anon, authenticated;

-- plpgsql + volatile (perlu menulis log). Tetap dipanggil via supabase.rpc (POST).
create or replace function public.get_circle_by_invite(p_code text)
returns setof public.circles
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.circles%rowtype;
begin
  perform public.invite_rate_limit_check();

  select * into v_row from public.circles
  where invite_code = upper(trim(p_code))
  limit 1;

  if not found then
    perform public.invite_rate_limit_log();
    return;
  end if;

  return next v_row;
end;
$$;
revoke all on function public.get_circle_by_invite(text) from public, anon;
grant execute on function public.get_circle_by_invite(text) to authenticated;

-- Kode salah -> return NULL (bukan raise), supaya log percobaan gagal tidak ikut rollback.
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

  perform public.invite_rate_limit_check();

  select * into v_circle from public.circles
  where invite_code = upper(trim(p_code))
  limit 1;
  if not found then
    perform public.invite_rate_limit_log();
    return null;
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

-- ================= 2) CHECK-IN: WAKTU DARI SERVER, HANYA 'joined' =================
-- (versi lengkap guard_circle_member_write = 0029 + bagian check-in di UPDATE)
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
    if public.circle_is_private(new.circle_id)
       and not v_admin
       and new.user_id is distinct from v_host then
      raise exception 'Circle private hanya bisa dimasuki lewat link undangan.';
    end if;

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

  if not v_admin and v_host is distinct from auth.uid() then
    -- hanya host/admin yang boleh ubah status (approve member)
    new.status := old.status;

    -- check-in mandiri: hanya member 'joined', timestamp ditentukan server
    if new.checked_in is distinct from old.checked_in
       or new.checked_in_at is distinct from old.checked_in_at then
      if old.status = 'joined' then
        new.checked_in_at := case
          when new.checked_in then coalesce(old.checked_in_at, now())
          else null
        end;
      else
        new.checked_in := old.checked_in;
        new.checked_in_at := old.checked_in_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ================= 3) CIRCLES: created_by tidak bisa dipindah =================
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_a_guard_circle_write on public.circles;
create trigger trg_a_guard_circle_write
  before update on public.circles
  for each row execute function public.guard_circle_write();
