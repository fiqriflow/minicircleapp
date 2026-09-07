-- Jalankan sekali di Supabase SQL Editor
-- Fitur: Admin bisa limit jumlah pendaftar baru (toggle + jumlah)

insert into app_settings (key, value) values ('registration_limit_enabled', 'false') on conflict (key) do nothing;
insert into app_settings (key, value) values ('registration_limit_count', '1000') on conflict (key) do nothing;
