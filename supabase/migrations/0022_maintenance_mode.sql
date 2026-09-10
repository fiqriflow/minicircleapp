insert into app_settings (key, value) values ('maintenance_mode', 'false')
on conflict (key) do nothing;
