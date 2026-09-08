-- OPSIONAL — jalankan HANYA jika sudah ada data lama tersimpan dengan nilai "Running"
-- (circle yang sudah dibuat, kesukaan aktivitas user, atau cover default per kategori).
-- Kalau project masih baru / belum ada data seperti itu, migration ini boleh dilewati.

-- 1) Circle yang sudah dibuat dengan kategori "Running"
update circles set category = 'Jogging' where category = 'Running';

-- 2) Kesukaan aktivitas user yang menyimpan array text categories
update profiles
set categories = array_replace(categories, 'Running', 'Jogging')
where 'Running' = any(categories);

-- 3) Setting cover default per kategori di admin appearance (key: default_circle_cover:Running)
update app_settings
set key = 'default_circle_cover:Jogging'
where key = 'default_circle_cover:Running';
