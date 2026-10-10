// Kolom circles yang boleh dibaca client. invite_code SENGAJA tidak ada (migration 0048):
// jangan pakai select("*") ke tabel circles. Kode undangan diambil host/co-host/admin
// lewat rpc("get_circle_invite_code"). Kolom baru di circles harus ditambah di sini
// DAN di-grant: grant select (kolom_baru) on public.circles to authenticated;
export const CIRCLE_COLUMNS =
  "id, name, group_name, description, category, city, location, lat, lng, event_date, started_at, finish_reminded_at, max_participants, is_circle_plus, is_private, join_question, requires_approval, join_gender, join_birth_year_min, join_birth_year_max, join_verified_only, allow_late_join, cover_url, status, created_by, created_at";

// Kolom circle + info host (untuk centang biru di kartu). `!created_by` = pilih FK created_by (hindari embed ambigu).
export const CIRCLE_WITH_HOST = `${CIRCLE_COLUMNS}, host:profiles!created_by(nickname, full_name, is_verified)`;
