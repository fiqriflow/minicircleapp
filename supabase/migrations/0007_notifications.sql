-- ================= NOTIFICATIONS =================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  circle_id uuid references circles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null, -- 'member_joined' | 'join_request' | 'new_comment' | 'circle_completed' | 'circle_cancelled' | 'slot_available'
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_dedupe_idx on notifications (user_id, circle_id, type, is_read);

alter table notifications enable row level security;

-- user cuma boleh lihat/update(read)/hapus notif miliknya sendiri. insert cuma lewat function security definer di bawah.
create policy "notifications_select_own" on notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on notifications for update using (auth.uid() = user_id);
create policy "notifications_delete_own" on notifications for delete using (auth.uid() = user_id);

-- ================= 1. NOTIF HOST: ada yang join / request join =================
create or replace function public.notify_new_member()
returns trigger as $$
declare
  v_host uuid;
  v_circle_name text;
  v_actor_name text;
begin
  select created_by, name into v_host, v_circle_name from circles where id = new.circle_id;
  if v_host is null or v_host = new.user_id then
    return new;
  end if;

  select coalesce(nickname, full_name, 'Seseorang') into v_actor_name from profiles where id = new.user_id;

  insert into notifications (user_id, circle_id, actor_id, type, message)
  values (
    v_host,
    new.circle_id,
    new.user_id,
    case when new.status = 'pending' then 'join_request' else 'member_joined' end,
    case when new.status = 'pending'
      then v_actor_name || ' mengajukan join circle "' || v_circle_name || '", menunggu persetujuanmu.'
      else v_actor_name || ' baru saja join circle "' || v_circle_name || '".'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_member on circle_members;
create trigger trg_notify_new_member
  after insert on circle_members
  for each row execute procedure public.notify_new_member();

-- ================= 2. NOTIF HOST: komentar baru (dedupe sampai tab komen dibuka) =================
create or replace function public.notify_new_comment()
returns trigger as $$
declare
  v_host uuid;
  v_circle_name text;
  v_actor_name text;
  v_existing_unread uuid;
begin
  select created_by, name into v_host, v_circle_name from circles where id = new.circle_id;
  if v_host is null or v_host = new.user_id then
    return new;
  end if;

  -- kalau masih ada notif "komen baru" utk circle ini yg belum dibaca, jangan bikin lagi (bukan tiap komen ada notif)
  select id into v_existing_unread
  from notifications
  where user_id = v_host and circle_id = new.circle_id and type = 'new_comment' and is_read = false
  limit 1;

  if v_existing_unread is not null then
    return new;
  end if;

  select coalesce(nickname, full_name, 'Seseorang') into v_actor_name from profiles where id = new.user_id;

  insert into notifications (user_id, circle_id, actor_id, type, message)
  values (v_host, new.circle_id, new.user_id, 'new_comment',
    v_actor_name || ' mengirim komentar baru di circle "' || v_circle_name || '".');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_new_comment on circle_comments;
create trigger trg_notify_new_comment
  after insert on circle_comments
  for each row execute procedure public.notify_new_comment();

-- ================= 3. NOTIF HOST: circle selesai karena waktu lewat =================
-- Catatan: durasi 3 jam mengikuti EVENT_DURATION_HOURS di lib/circleStatus.ts. Kalau nilai itu diubah, ubah juga di sini.
-- Time-based, jadi tidak bisa pakai trigger row-event biasa. Function ini dipanggil lewat RPC dari client
-- (lihat lib/notifications.ts) tiap kali komponen notif dibuka. Aman dipanggil berkali-kali (idempotent,
-- karena hanya memproses circle yang status-nya masih 'active').
create or replace function public.mark_completed_circles()
returns void as $$
declare
  r record;
begin
  for r in
    select id, name, created_by
    from circles
    where status = 'active'
      and event_date + interval '3 hours' < now()
  loop
    update circles set status = 'completed' where id = r.id;
    if r.created_by is not null then
      insert into notifications (user_id, circle_id, type, message)
      values (r.created_by, r.id, 'circle_completed', 'Circle "' || r.name || '" sudah selesai (waktu sudah lewat).');
    end if;
  end loop;
end;
$$ language plpgsql security definer;

grant execute on function public.mark_completed_circles() to authenticated;

-- ================= 4. NOTIF MEMBER: circle dibatalkan host =================
create or replace function public.notify_circle_cancelled()
returns trigger as $$
declare
  v_member record;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    for v_member in
      select user_id from circle_members where circle_id = new.id and status = 'joined' and user_id <> new.created_by
    loop
      insert into notifications (user_id, circle_id, type, message)
      values (v_member.user_id, new.id, 'circle_cancelled', 'Circle "' || new.name || '" dibatalkan oleh host.');
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_circle_cancelled on circles;
create trigger trg_notify_circle_cancelled
  after update on circles
  for each row execute procedure public.notify_circle_cancelled();

-- ================= 5. NOTIF USER SEKOTA: slot terbuka krn ada yg mengundurkan diri =================
-- Domisili dicocokkan dari profiles.location (diisi saat onboarding) vs circles.city.
create or replace function public.notify_slot_available()
returns trigger as $$
declare
  v_circle record;
  v_current_count int;
  v_profile record;
begin
  if old.status <> 'joined' then
    return old;
  end if;

  select * into v_circle from circles where id = old.circle_id;
  if v_circle.id is null or v_circle.max_participants is null then
    return old;
  end if;
  if v_circle.status <> 'active' or v_circle.event_date <= now() then
    return old;
  end if;

  select count(*) into v_current_count
  from circle_members
  where circle_id = old.circle_id and status = 'joined';

  -- hanya notif kalau SEBELUM row ini dihapus, circle-nya pas penuh (count sekarang + 1 == max)
  if v_current_count + 1 <> v_circle.max_participants then
    return old;
  end if;

  for v_profile in
    select p.id
    from profiles p
    where p.location is not null
      and p.location = v_circle.city
      and p.id <> v_circle.created_by
      and p.id <> old.user_id
      and not exists (
        select 1 from circle_members cm
        where cm.circle_id = v_circle.id and cm.user_id = p.id and cm.status = 'joined'
      )
      and not exists (
        select 1 from notifications n
        where n.user_id = p.id and n.circle_id = v_circle.id and n.type = 'slot_available' and n.is_read = false
      )
  loop
    insert into notifications (user_id, circle_id, type, message)
    values (v_profile.id, v_circle.id, 'slot_available',
      'Slot baru terbuka di circle "' || v_circle.name || '"' ||
      case when v_circle.city is not null then ' (' || v_circle.city || ')' else '' end || '.');
  end loop;

  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_slot_available on circle_members;
create trigger trg_notify_slot_available
  after delete on circle_members
  for each row execute procedure public.notify_slot_available();
