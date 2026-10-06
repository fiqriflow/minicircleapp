-- Jalankan sekali di Supabase SQL Editor (setelah 0046)
-- Circle+: host bisa membatasi siapa yang boleh join (gender, tahun lahir/generasi, verified saja).
-- Berlaku untuk join baru (juga lewat link undangan). Member yang sudah join tidak dikeluarkan.
-- Host & super admin tidak kena filter.

-- ================= 1) KOLOM =================
alter table public.circles add column if not exists join_gender text;
alter table public.circles add column if not exists join_birth_year_min int;
alter table public.circles add column if not exists join_birth_year_max int;
alter table public.circles add column if not exists join_verified_only boolean not null default false;

alter table public.circles drop constraint if exists circles_join_gender_chk;
alter table public.circles add constraint circles_join_gender_chk check (join_gender is null or join_gender in ('male', 'female'));

-- ================= 2) RAPIKAN: filter hanya untuk Circle+ =================
create or replace function public.normalize_join_filters()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if not coalesce(new.is_circle_plus, false) then
    new.join_gender := null;
    new.join_birth_year_min := null;
    new.join_birth_year_max := null;
    new.join_verified_only := false;
    return new;
  end if;

  if new.join_birth_year_min is not null and (new.join_birth_year_min < 1940 or new.join_birth_year_min > 2100) then
    new.join_birth_year_min := null;
  end if;
  if new.join_birth_year_max is not null and (new.join_birth_year_max < 1940 or new.join_birth_year_max > 2100) then
    new.join_birth_year_max := null;
  end if;
  if new.join_birth_year_min is not null and new.join_birth_year_max is not null
     and new.join_birth_year_min > new.join_birth_year_max then
    raise exception 'Rentang tahun lahir tidak valid';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_c_normalize_join_filters on public.circles;
create trigger trg_c_normalize_join_filters
  before insert or update on public.circles
  for each row execute function public.normalize_join_filters();

-- ================= 3) TERAPKAN SAAT JOIN (juga lewat RPC join_circle_by_invite) =================
create or replace function public.enforce_join_filters()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  p record;
  v_year int;
begin
  if auth.uid() is null or public.is_super_admin_caller() then
    return new;
  end if;

  select created_by, join_gender, join_birth_year_min, join_birth_year_max, join_verified_only
    into c
  from public.circles where id = new.circle_id;

  if c.created_by is null or new.user_id = c.created_by then
    return new;
  end if;

  if c.join_gender is null and c.join_birth_year_min is null
     and c.join_birth_year_max is null and not c.join_verified_only then
    return new;
  end if;

  select gender, birth_date, is_verified into p from public.profiles where id = new.user_id;

  if c.join_gender is not null and p.gender is distinct from c.join_gender then
    raise exception 'Circle ini khusus %.', case c.join_gender when 'female' then 'perempuan' else 'laki-laki' end;
  end if;

  if c.join_birth_year_min is not null or c.join_birth_year_max is not null then
    v_year := extract(year from p.birth_date)::int;
    if v_year is null
       or (c.join_birth_year_min is not null and v_year < c.join_birth_year_min)
       or (c.join_birth_year_max is not null and v_year > c.join_birth_year_max) then
      raise exception 'Circle ini khusus kelahiran %.',
        case
          when c.join_birth_year_min is not null and c.join_birth_year_max is not null
            then 'tahun ' || c.join_birth_year_min || '-' || c.join_birth_year_max
          when c.join_birth_year_min is not null then 'tahun ' || c.join_birth_year_min || ' ke atas'
          else 'tahun ' || c.join_birth_year_max || ' ke bawah'
        end;
    end if;
  end if;

  if c.join_verified_only and not coalesce(p.is_verified, false) then
    raise exception 'Circle ini khusus akun terverifikasi (centang biru). Ajukan di Profil > Verifikasi Akun.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_c_enforce_join_filters on public.circle_members;
create trigger trg_c_enforce_join_filters
  before insert on public.circle_members
  for each row execute function public.enforce_join_filters();
