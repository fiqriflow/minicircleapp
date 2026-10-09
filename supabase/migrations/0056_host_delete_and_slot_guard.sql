-- Jalankan sekali di Supabase SQL Editor (setelah 0055)
--  1) Host hapus akun -> circle AKTIF miliknya otomatis dibatalkan (peserta dapat notifikasi "dibatalkan").
--     Sebelumnya circle itu tetap `active` dengan created_by = NULL: tidak ada yang bisa menyelesaikan /
--     membatalkannya, tetapi tetap bisa di-join orang lain di Explore.
--  2) Host tidak boleh menurunkan slot di bawah jumlah peserta yang sudah join.

-- ================= 1) HAPUS AKUN HOST =================
-- Nama trigger "trg_c_" -> jalan SETELAH trg_a_guard_profile_delete (yang menolak hapus saat banned/suspend)
-- dan trg_b_snapshot_energy_on_delete. Circle yang sudah lama lewat (> 3 jam) dibiarkan apa adanya.
create or replace function public.cancel_hosted_circles_on_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.circles
     set status = 'cancelled'
   where created_by = old.id
     and status = 'active'
     and event_date >= now() - interval '3 hours';
  return old;
end;
$$;

drop trigger if exists trg_c_cancel_hosted_circles on public.profiles;
create trigger trg_c_cancel_hosted_circles
  before delete on public.profiles
  for each row execute function public.cancel_hosted_circles_on_delete();

-- ================= 2) SLOT TIDAK BOLEH < PESERTA JOIN =================
create or replace function public.guard_circle_min_slots()
returns trigger
language plpgsql set search_path = public
as $$
declare
  v_joined integer;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.max_participants is null or new.max_participants is not distinct from old.max_participants then
    return new;
  end if;
  if public.is_super_admin_caller() then
    return new;
  end if;

  select count(*) into v_joined
    from public.circle_members
   where circle_id = new.id and status = 'joined';

  if new.max_participants < v_joined then
    raise exception 'Slot tidak boleh lebih kecil dari peserta yang sudah join (% orang).', v_joined;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_circle_min_slots on public.circles;
create trigger trg_circle_min_slots
  before update on public.circles
  for each row
  when (new.max_participants is distinct from old.max_participants)
  execute function public.guard_circle_min_slots();
