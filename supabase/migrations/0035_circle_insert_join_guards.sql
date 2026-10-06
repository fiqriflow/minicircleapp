-- Jalankan sekali di Supabase SQL Editor (setelah 0034)
-- Fix audit (sedang):
--  1) INSERT circles lewat PostgREST tanpa guard: event_date lampau, started_at/status
--     diisi sendiri (bypass aturan "selesai" -> penalti no-show massal), dan
--     is_circle_plus tetap bisa walau admin mematikan circle_plus_enabled.
--  2) Join ke circle yang sudah tidak aktif / sudah lewat (RPC invite ikut terkena).

-- ================= 1) GUARD INSERT CIRCLES =================
create or replace function public.guard_circle_insert()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_plus text;
begin
  -- hanya request client (PostgREST); SQL Editor / service role lolos
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_super_admin_caller() then
    return new;
  end if;

  if new.event_date < now() - interval '5 minutes' then
    raise exception 'Tanggal acara tidak boleh di masa lalu.';
  end if;

  new.status := 'active';
  new.started_at := null;

  if coalesce(new.is_circle_plus, false) then
    select value into v_plus from public.app_settings where key = 'circle_plus_enabled';
    if v_plus = 'false' then
      raise exception 'Circle Plus sedang dinonaktifkan.';
    end if;
  end if;

  return new;
end;
$$;

-- prefix trg_a_ -> jalan sebelum trigger potong energy (urut alfabet)
drop trigger if exists trg_a_guard_circle_insert on public.circles;
create trigger trg_a_guard_circle_insert
  before insert on public.circles
  for each row execute function public.guard_circle_insert();

-- ================= 2) GUARD JOIN KE CIRCLE TIDAK AKTIF =================
-- Tanpa cek current_user supaya RPC join_circle_by_invite (security definer) ikut kena.
-- auth.uid() null = SQL Editor / service role -> lolos.
create or replace function public.guard_circle_member_join_active()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
  v_date timestamptz;
begin
  if auth.uid() is null or public.is_super_admin_caller() then
    return new;
  end if;

  select status, event_date into v_status, v_date
  from public.circles where id = new.circle_id;

  if v_status is distinct from 'active' or v_date + interval '3 hours' < now() then
    raise exception 'Circle ini sudah tidak aktif.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_b_guard_member_join_active on public.circle_members;
create trigger trg_b_guard_member_join_active
  before insert on public.circle_members
  for each row execute function public.guard_circle_member_join_active();
