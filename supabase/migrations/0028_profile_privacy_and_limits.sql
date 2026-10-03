-- Jalankan sekali di Supabase SQL Editor (setelah 0027)
-- 1) Sembunyikan data pribadi (birth_date, lat, lng, suspension_reason) dari user lain
-- 2) Rate limit + batas panjang untuk feedback & report
--
-- CATATAN: setelah ini `select("*")` ke tabel profiles dari client akan ERROR.
--   - baca profil SENDIRI  -> supabase.rpc("get_my_profile").single()
--   - baca profil ORANG LAIN -> sebutkan kolom satu per satu
--   - tiap kali nambah kolom baru di profiles yang boleh dibaca client:
--     jalankan `grant select (nama_kolom) on public.profiles to authenticated;`

-- ================= 1) PROFILE PRIVACY =================
create or replace function public.get_my_profile()
returns setof public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in ('birth_date', 'lat', 'lng', 'suspension_reason');

  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;

-- ================= 2) FEEDBACK & REPORT =================
alter table public.feedback drop constraint if exists feedback_message_len;
alter table public.feedback
  add constraint feedback_message_len check (char_length(message) between 1 and 2000) not valid;

alter table public.reports drop constraint if exists reports_text_len;
alter table public.reports
  add constraint reports_text_len
  check (char_length(reason) <= 300 and char_length(coalesce(description, '')) <= 2000) not valid;

-- feedback cuma bisa dibaca admin (RLS), jadi hitungan dilakukan lewat helper security definer
create or replace function public.recent_feedback_count(p_user uuid)
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*) from public.feedback
  where user_id = p_user and created_at > now() - interval '1 hour';
$$;
revoke all on function public.recent_feedback_count(uuid) from public, anon;
grant execute on function public.recent_feedback_count(uuid) to authenticated;

create or replace function public.rate_limit_feedback()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user = 'authenticated' and public.recent_feedback_count(new.user_id) >= 5 then
    raise exception 'Terlalu banyak masukan dalam 1 jam, coba lagi nanti.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_a_rate_limit_feedback on public.feedback;
create trigger trg_a_rate_limit_feedback
  before insert on public.feedback
  for each row execute function public.rate_limit_feedback();

create or replace function public.rate_limit_reports()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and (select count(*) from public.reports
          where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Terlalu banyak laporan dalam 1 jam, coba lagi nanti.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_a_rate_limit_reports on public.reports;
create trigger trg_a_rate_limit_reports
  before insert on public.reports
  for each row execute function public.rate_limit_reports();
