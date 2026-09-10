-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Konsekuensi no-show. Begitu circle berubah status jadi 'completed'
-- (baik otomatis lewat mark_completed_circles(), maupun host tandai manual),
-- semua member yang joined tapi gak checked_in di-potong energy -1 (floor 0)
-- + dapet notifikasi warning.

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

drop trigger if exists trg_penalize_no_show on circles;
create trigger trg_penalize_no_show
  after update on circles
  for each row execute procedure public.penalize_no_show();
