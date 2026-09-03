-- Jalankan file ini sekali di Supabase SQL Editor
-- Cegah join circle yang sudah penuh di level DB (hindari race condition 2 user join bersamaan)

create or replace function public.check_circle_slot()
returns trigger as $$
declare
  v_max int;
  v_joined int;
begin
  if new.status = 'joined' then
    select max_participants into v_max from circles where id = new.circle_id;
    if v_max is not null then
      select count(*) into v_joined from circle_members
        where circle_id = new.circle_id and status = 'joined' and id <> new.id;
      if v_joined >= v_max then
        raise exception 'Slot circle ini sudah penuh';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_check_circle_slot on circle_members;
create trigger trg_check_circle_slot
  before insert or update on circle_members
  for each row execute procedure public.check_circle_slot();
