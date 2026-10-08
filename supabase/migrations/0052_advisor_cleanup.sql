-- Jalankan sekali di Supabase SQL Editor (setelah 0051)
-- Bersihkan warning Advisors > Security:
--  1) search_path mutable pada 2 fungsi helper 0051
--  2) Fungsi TRIGGER (security definer) tidak perlu bisa dipanggil lewat /rest/v1/rpc
--     -> cabut EXECUTE dari public/anon/authenticated. Trigger tetap jalan normal
--     (hak EXECUTE hanya dicek saat CREATE TRIGGER, bukan saat trigger firing).
-- Yang SENGAJA tidak disentuh: RPC yang dipakai client (admin_*, get_*, join_circle_by_invite, dst),
-- serta helper yang dipanggil dari guard/RLS (is_super_admin_caller, energy_snapshot_for_me,
-- enforce_registration_limit, circle_*, is_account_blocked, recent_feedback_count, dll).

-- ================= 1) SEARCH_PATH =================
alter function public.app_storage_public_base() set search_path = '';
alter function public.normalize_instagram(text) set search_path = '';

-- ================= 2) CABUT EXECUTE FUNGSI TRIGGER =================
do $$
declare
  fn text;
  fns text[] := array[
    'charge_join_energy', 'check_and_deduct_energy', 'check_circle_slot',
    'enforce_join_filters', 'guard_circle_member_join_active',
    'guard_feedback_insert', 'guard_report_insert', 'handle_new_user',
    'log_account_deleted', 'log_circle_created', 'log_user_registered',
    'log_user_suspension_change', 'notify_circle_cancelled',
    'notify_cohost_join_request', 'notify_new_comment', 'notify_new_member',
    'notify_slot_available', 'penalize_no_show', 'require_complete_profile',
    'require_join_answer', 'snapshot_energy_on_self_delete'
  ];
begin
  foreach fn in array fns loop
    if to_regprocedure('public.' || fn || '()') is not null then
      execute format('revoke all on function public.%I() from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;
