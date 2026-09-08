-- ================= PUSH SUBSCRIPTIONS (Web Push ke HP) =================
-- Satu user bisa punya lebih dari 1 subscription (lebih dari 1 device/browser).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- User cuma boleh kelola subscription miliknya sendiri.
create policy "push_subscriptions_select_own" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- Service role (dipakai API route pengirim push) otomatis bypass RLS, tidak perlu policy tambahan.
