-- Jalankan sekali di Supabase SQL Editor (setelah 0036)
-- Audit kecepatan:
--  1) Index untuk query yang dipakai app (sebelumnya seq scan).
--  2) mark_completed_circles ditulis ulang agar bisa pakai index, lalu dijadwalkan lewat pg_cron
--     (sebelumnya dipanggil client tiap user tiap 15 dtk).

-- ================= 1) INDEX =================
-- explore / home / my-circle / mark_completed_circles: circle aktif berdasarkan tanggal
create index if not exists circles_active_event_date_idx on public.circles (event_date) where status = 'active';
create index if not exists circles_created_by_idx        on public.circles (created_by);
create index if not exists circles_category_idx          on public.circles (category);

-- my-circle, explore (joinedIds), hitung peserta, RLS exists(...)
create index if not exists circle_members_user_idx        on public.circle_members (user_id, status);
create index if not exists circle_members_circle_status_idx on public.circle_members (circle_id, status);

-- chat grup: ambil komen per circle berurutan waktu / hanya yang terbaru
create index if not exists circle_comments_circle_time_idx on public.circle_comments (circle_id, created_at);

-- halaman admin (urut terbaru)
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists feedback_created_idx     on public.feedback (created_at desc);

-- ================= 2) mark_completed_circles: sargable + search_path =================
-- Sama persis dengan versi 0007, hanya kondisi waktu ditulis ulang agar index bisa dipakai.
create or replace function public.mark_completed_circles()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id, name, created_by
    from public.circles
    where status = 'active'
      and event_date < now() - interval '3 hours'
  loop
    update public.circles set status = 'completed' where id = r.id;
    if r.created_by is not null then
      insert into public.notifications (user_id, circle_id, type, message)
      values (r.created_by, r.id, 'circle_completed', 'Circle "' || r.name || '" sudah selesai (waktu sudah lewat).');
    end if;
  end loop;
end;
$$;
revoke all on function public.mark_completed_circles() from public, anon;
grant execute on function public.mark_completed_circles() to authenticated, service_role;

-- ================= 3) PG_CRON: tutup circle yang lewat waktu tiap 5 menit =================
-- Jika pg_cron tidak bisa diaktifkan di project ini, migration tetap lanjut (hanya NOTICE);
-- app tetap menutup circle saat ada user membuka app (dipanggil sekali per sesi di client).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'mark-completed-circles';
  perform cron.schedule('mark-completed-circles', '*/5 * * * *', 'select public.mark_completed_circles()');
exception when others then
  raise notice 'pg_cron tidak aktif (%). Aktifkan di Dashboard > Database > Extensions > pg_cron, lalu jalankan ulang blok ini.', sqlerrm;
end $$;
