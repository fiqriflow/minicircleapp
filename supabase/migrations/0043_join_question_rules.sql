-- Jalankan sekali di Supabase SQL Editor (setelah 0042)
-- Aturan pertanyaan join (Circle+):
--  1) Pertanyaan hanya ada kalau requires_approval aktif (maks 200 karakter)
--  2) Kalau ada pertanyaan, pelamar WAJIB menjawab (maks 200 karakter)

-- ================= 1) PERTANYAAN HANYA UNTUK CIRCLE DENGAN APPROVAL =================
create or replace function public.normalize_join_question()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if not coalesce(new.requires_approval, false) then
    new.join_question := null;
  else
    new.join_question := nullif(left(trim(coalesce(new.join_question, '')), 200), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_c_normalize_join_question on public.circles;
create trigger trg_c_normalize_join_question
  before insert or update on public.circles
  for each row execute function public.normalize_join_question();

-- bersihkan data lama: pertanyaan tanpa approval tidak berguna
update public.circles
set join_question = null
where join_question is not null and not coalesce(requires_approval, false);

-- ================= 2) JAWABAN WAJIB (juga lewat RPC join_circle_by_invite) =================
create or replace function public.require_join_answer()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_question text;
  v_host uuid;
begin
  if auth.uid() is null or public.is_super_admin_caller() then
    return new;
  end if;

  select join_question, created_by into v_question, v_host
  from public.circles where id = new.circle_id;

  if v_question is null or new.user_id is not distinct from v_host then
    return new;
  end if;

  new.join_answer := trim(coalesce(new.join_answer, ''));
  if new.join_answer = '' then
    raise exception 'Pertanyaan join wajib dijawab.';
  end if;
  if length(new.join_answer) > 200 then
    raise exception 'Jawaban maksimal 200 karakter.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_c_require_join_answer on public.circle_members;
create trigger trg_c_require_join_answer
  before insert on public.circle_members
  for each row execute function public.require_join_answer();
