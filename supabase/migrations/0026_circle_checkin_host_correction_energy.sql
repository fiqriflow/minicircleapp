-- Jalankan sekali di Supabase SQL Editor
-- Fix: koreksi check-in oleh host (setelah circle selesai) sekarang ikut
-- menyesuaikan energy + kirim notifikasi, bukan cuma ubah status hadir doang.
--
-- - Host tandai "Hadir" utk member yg sebelumnya kena potong energy -> energy
--   dikembalikan +1 (max 7) + notif.
-- - Host tandai "Batalkan" (jadi gak hadir) utk member yg belum pernah kena
--   potong -> energy dipotong -1 (floor 0) + notif.
-- - Ada flag energy_penalized biar gak dobel potong/refund kalau host bolak-balik toggle.

-- 1) Flag penanda "baris ini udah pernah kena potong energy krn no-show"
alter table circle_members add column if not exists energy_penalized boolean not null default false;

-- 2) Update trigger auto-penalty pas circle completed: skalian set flag energy_penalized
create or replace function public.penalize_no_show()
returns trigger as $$
declare
  v_member record;
  v_new_energy int;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    for v_member in
      select user_id from circle_members
      where circle_id = new.id and status = 'joined' and checked_in = false
    loop
      perform public.ensure_energy_reset(v_member.user_id);

      update profiles set energy = greatest(0, energy - 1)
      where id = v_member.user_id
      returning energy into v_new_energy;

      update circle_members set energy_penalized = true
      where circle_id = new.id and user_id = v_member.user_id;

      insert into notifications (user_id, circle_id, type, message)
      values (
        v_member.user_id,
        new.id,
        'no_show_energy',
        'Kamu gak check-in di circle "' || new.name || '", energy kamu dikurangi 1 (sisa ' || coalesce(v_new_energy, 0) || '/7). Jangan lupa check-in ya lain kali!'
      );
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 3) RPC dipanggil host utk koreksi check-in setelah circle selesai.
--    Security definer krn host gak punya izin RLS update profiles.energy langsung.
create or replace function public.host_set_checkin(p_member_row_id uuid, p_checked_in boolean)
returns void as $$
declare
  v_row record;
  v_circle record;
  v_new_energy int;
begin
  select cm.*, c.created_by as host_id, c.status as circle_status, c.name as circle_name
    into v_row
  from circle_members cm
  join circles c on c.id = cm.circle_id
  where cm.id = p_member_row_id;

  if v_row.id is null then
    raise exception 'Data member tidak ditemukan';
  end if;

  if v_row.host_id is null or v_row.host_id <> auth.uid() then
    raise exception 'Cuma host circle yang boleh koreksi check-in';
  end if;

  update circle_members
  set checked_in = p_checked_in,
      checked_in_at = case when p_checked_in then now() else null end
  where id = p_member_row_id;

  -- energy cuma disesuaikan kalau circle-nya udah selesai (penalti sudah/akan dievaluasi)
  if v_row.circle_status = 'completed' then
    if p_checked_in and v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      update profiles set energy = least(7, energy + 1)
      where id = v_row.user_id
      returning energy into v_new_energy;

      update circle_members set energy_penalized = false where id = p_member_row_id;

      insert into notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Hadir, energy kamu dikembalikan (sisa ' || coalesce(v_new_energy, 0) || '/7).'
      );
    elsif not p_checked_in and not v_row.energy_penalized then
      perform public.ensure_energy_reset(v_row.user_id);
      update profiles set energy = greatest(0, energy - 1)
      where id = v_row.user_id
      returning energy into v_new_energy;

      update circle_members set energy_penalized = true where id = p_member_row_id;

      insert into notifications (user_id, circle_id, type, message)
      values (
        v_row.user_id, v_row.circle_id, 'no_show_energy',
        'Host mengoreksi kehadiranmu di circle "' || v_row.circle_name || '" jadi Tidak Hadir, energy kamu dikurangi 1 (sisa ' || coalesce(v_new_energy, 0) || '/7).'
      );
    end if;
  end if;
end;
$$ language plpgsql security definer;

grant execute on function public.host_set_checkin(uuid, boolean) to authenticated;
