alter table feedback add column if not exists category text not null default 'other'
  check (category in ('bug', 'feature', 'other'));
alter table feedback add column if not exists source text not null default 'masukan'
  check (source in ('masukan', 'circle_plus_coming_soon'));
