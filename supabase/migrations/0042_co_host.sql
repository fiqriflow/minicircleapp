-- Jalankan sekali di Supabase SQL Editor (setelah 0041)
-- Fitur Circle+: host bisa tunjuk Co Host (maks 2).
-- Hak Co Host: terima/tolak permintaan join, baca jawaban join, koreksi hadir.
-- Co Host TIDAK bisa: edit/batalkan/hapus circle, tandai mulai/selesai, kick member, tunjuk co host lain.

-- ================= 1) KOLOM =================
alter table public.circle_members add column if not exists is_co_host boolean not null default false;
grant select (is_co_host) on public.circle_members to authenticated; -- select kolom dibatasi sejak 0030
create index if not exists circle_members_cohost_idx on public.circle_members (circle_id) where is_co_host;

-- ================= 2) HELPER =================
-- true kalau auth.uid() adalah co host (joined) di circle Circle+ ini
create or replace function public.is_circle_cohost(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members m
    join public.circles c on c.id = m.circle_id
    where m.circle_id = p_circle_id
      and m.user_id = auth.uid()
      and m.status = 'joined'
      and m.is_co_host
      and coalesce(c.is_circle_plus, false)
  );
$$;
revoke all on function public.is_circle_cohost(uuid) from public, anon;
grant execute on function public.is_circle_cohost(uuid) to authenticated;

-- ================= 3) RPC TUNJUK / CABUT CO HOST =================
create or replace function public.set_circle_co_host(p_member_row_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_count int;
begin
  select m.id, m.user_id, m.status, m.circle_id, m.is_co_host,
         c.created_by as host_id, c.name as circle_name,
         c.status as circle_status, coalesce(c.is_circle_plus, false) as is_plus
    into v_row
  from public.circle_members m
  join public.circles c on c.id = m.circle_id
  where m.id = p_member_row_id;

  if v_row.id is null then
    raise exception 'Data member tidak ditemukan';
  end if;

  if v_row.host_id is distinct from auth.uid() and not public.is_super_admin_caller() then
    raise exception 'Cuma host circle yang boleh tunjuk co host';
  end if;

  if not v_row.is_plus then
    raise exception 'Co host hanya tersedia untuk Circle+';
  end if;

  if v_row.user_id = v_row.host_id then
    raise exception 'Host tidak bisa jadi co host';
  end if;

  if p_value then
    if v_row.circle_status <> 'active' then
      raise exception 'Circle sudah tidak aktif';
    end if;
    if v_row.status <> 'joined' then
      raise exception 'Hanya member yang sudah join yang bisa jadi co host';
    end if;
    if v_row.is_co_host then
      return;
    end if;
    select count(*) into v_count
    from public.circle_members
    where circle_id = v_row.circle_id and is_co_host;
    if v_count >= 2 then
      raise exception 'Maksimal 2 co host per circle';
    end if;
  elsif not v_row.is_co_host then
    return;
  end if;

  update public.circle_members set is_co_host = p_value where id = p_member_row_id;

  insert into public.notifications (user_id, circle_id, actor_id, type, message)
  values (
    v_row.user_id, v_row.circle_id, auth.uid(),
    case when p_value then 'co_host_appointed' else 'co_host_removed' end,
    case when p_value
      then 'Kamu ditunjuk jadi Co Host di circle "' || v_row.circle_name || '".'
      else 'Peran Co Host kamu di circle "' || v_row.circle_name || '" dicabut.'
    end
  );
end;
$$;
revoke all on function public.set_circle_co_host(uuid, boolean) from public, anon;
grant execute on function public.set_circle_co_host(uuid, boolean) to authenticated;

-- ================= 4) GUARD MEMBER (versi lengkap dari 0031 + co host) =================
create or replace function public.guard_circle_member_write()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_host uuid;
  v_approval boolean;
  v_admin boolean;
  v_cohost boolean;
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
    new.is_co_host := false;
    return new;
  end if;

  -- UPDATE: kolom identitas, penalti & co host tidak boleh diubah lewat client
  -- (co host hanya lewat RPC set_circle_co_host)
  new.circle_id := old.circle_id;
  new.user_id := old.user_id;
  new.join_answer := old.join_answer;
  new.joined_at := old.joined_at;
  new.energy_penalized := old.energy_penalized;
  new.is_co_host := old.is_co_host;

  if not v_admin and v_host is distinct from auth.uid() then
    v_cohost := public.is_circle_cohost(new.circle_id);

    -- status: host/admin bebas; co host hanya boleh terima (pending -> joined) member lain
    if not (v_cohost and old.status = 'pending' and new.status = 'joined'
            and old.user_id is distinct from auth.uid()) then
      new.status := old.status;
    end if;

    if v_cohost and old.user_id is distinct from auth.uid() then
      -- co host koreksi hadir lewat RPC host_set_checkin, bukan UPDATE langsung
      new.checked_in := old.checked_in;
      new.checked_in_at := old.checked_in_at;
    elsif new.checked_in is distinct from old.checked_in
       or new.checked_in_at is distinct from old.checked_in_at then
      -- check-in mandiri: hanya member 'joined', timestamp ditentukan server
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

-- ================= 5) POLICY CO HOST =================
-- terima member pending (status dibatasi guard di atas)
drop policy if exists "members_update_cohost" on public.circle_members;
create policy "members_update_cohost" on public.circle_members
  for update using (public.is_circle_cohost(circle_id));

-- tolak permintaan join (hanya baris pending)
drop policy if exists "members_delete_cohost" on public.circle_members;
create policy "members_delete_cohost" on public.circle_members
  for delete using (public.is_circle_cohost(circle_id) and status = 'pending');

-- ================= 6) JAWABAN JOIN: co host ikut boleh baca =================
create or replace function public.get_circle_join_answers(p_circle_id uuid)
returns table(member_id uuid, join_answer text)
language sql stable security definer set search_path = public
as $$
  select m.id, m.join_answer
  from public.circle_members m
  join public.circles c on c.id = m.circle_id
  where m.circle_id = p_circle_id
    and (c.created_by = auth.uid()
         or public.is_super_admin_caller()
         or public.is_circle_cohost(p_circle_id));
$$;
revoke all on function public.get_circle_join_answers(uuid) from public, anon;
grant execute on function public.get_circle_join_answers(uuid) to authenticated;

-- ================= 7) KOREKSI HADIR: co host ikut boleh (versi lengkap dari 0032) =================
create or replace function public.host_set_checkin(p_member_row_id uuid, p_checked_in boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row record;
  v_new_energy int;
begin
  select cm.*, c.created_by as host_id, c.status as circle_status, c.name as circle_name
    into v_row
  from public.circle_members cm
  join public.circles c on c.id = cm.circle_id
  where cm.id = p_member_row_id;

  if v_row.id is null then
    raise exception 'Data member tidak ditemukan';
  end if;

  if (v_row.host_id is null or v_row.host_id <> auth.uid())
     and not public.is_circle_cohost(v_row.circle_id) then
    raise exception 'Cuma host / co host circle yang boleh koreksi check-in';
  end if;

  update public.circle_members
  set checked_in = p_checked_in,
      checked_in_at = case when p_checked_in then now() else null end
  where id = p_member_row_id;

  -- energy cuma disesuaikan kalau circle-nya udah selesai
  if v_row.circle_status = 'completed' then
    if p_checked_in and v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      update public.profiles set energy = energy + 1
      where id = v_row.user_id
      returning energy into v_new_energy;

      update public.circle_members set energy_penalized = false where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Hadir, energy kamu dikembalikan (sisa ' || coalesce(v_new_energy, 0) || ').'
      );
    elsif not p_checked_in and not v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      update public.profiles set energy = greatest(0, energy - 1)
      where id = v_row.user_id
      returning energy into v_new_energy;

      update public.circle_members set energy_penalized = true where id = p_member_row_id;

      insert into public.notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Tidak Hadir, energy kamu dikurangi 1 (sisa ' || coalesce(v_new_energy, 0) || ').'
      );
    end if;
  end if;
end;
$$;
revoke all on function public.host_set_checkin(uuid, boolean) from public, anon;
grant execute on function public.host_set_checkin(uuid, boolean) to authenticated;

-- ================= 8) NOTIF CO HOST: ada permintaan join =================
create or replace function public.notify_cohost_join_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_circle_name text;
  v_actor_name text;
  r record;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select name into v_circle_name from public.circles where id = new.circle_id;
  select coalesce(nickname, full_name, 'Seseorang') into v_actor_name from public.profiles where id = new.user_id;

  for r in
    select user_id from public.circle_members
    where circle_id = new.circle_id and is_co_host and status = 'joined' and user_id <> new.user_id
  loop
    insert into public.notifications (user_id, circle_id, actor_id, type, message)
    values (
      r.user_id, new.circle_id, new.user_id, 'join_request',
      v_actor_name || ' mengajukan join circle "' || v_circle_name || '", menunggu persetujuanmu.'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_cohost_join_request on public.circle_members;
create trigger trg_notify_cohost_join_request
  after insert on public.circle_members
  for each row execute function public.notify_cohost_join_request();
