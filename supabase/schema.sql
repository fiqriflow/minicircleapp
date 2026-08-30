-- ================= PROFILES =================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  nickname text,
  categories text[] default '{}',        -- ['Gowes','Jalan Santai','Running']
  location text,
  lat double precision,
  lng double precision,
  gender text,                            -- 'male' | 'female'
  instagram text,
  avatar_url text,
  is_super_admin boolean default false,
  created_at timestamptz default now()
);

-- ================= CIRCLES (Kelompok/Mabar) =================
create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_name text,
  description text,
  category text not null,                 -- 'Gowes','Jalan Santai','Running', dst
  location text not null,
  lat double precision,
  lng double precision,
  event_date timestamptz not null,
  max_participants int check (max_participants between 5 and 10) default 10,
  cover_url text,
  status text default 'active',           -- 'active' | 'completed' | 'cancelled'
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ================= CIRCLE MEMBERS =================
create table if not exists circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text default 'joined',           -- 'joined' | 'left'
  joined_at timestamptz default now(),
  unique(circle_id, user_id)
);

-- ================= CIRCLE COMMENTS (chat grup) =================
create table if not exists circle_comments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- ================= TRIGGER: auto create profile saat sign up =================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================= RLS =================
alter table profiles enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table circle_comments enable row level security;

-- profiles: semua bisa lihat, hanya pemilik bisa insert/update
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- circles: semua bisa lihat, hanya login bisa create, hanya admin/creator update/delete
create policy "circles_select_all" on circles for select using (true);
create policy "circles_insert_auth" on circles for insert with check (auth.uid() is not null);
create policy "circles_update_owner_or_admin" on circles for update using (
  auth.uid() = created_by or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);
create policy "circles_delete_owner_or_admin" on circles for delete using (
  auth.uid() = created_by or exists (select 1 from profiles p where p.id = auth.uid() and p.is_super_admin)
);

-- circle_members
create policy "members_select_all" on circle_members for select using (true);
create policy "members_insert_own" on circle_members for insert with check (auth.uid() = user_id);
create policy "members_delete_own" on circle_members for delete using (auth.uid() = user_id);

-- circle_comments: hanya member yang join boleh insert/select
create policy "comments_select_member" on circle_comments for select using (
  exists (select 1 from circle_members m where m.circle_id = circle_comments.circle_id and m.user_id = auth.uid())
);
create policy "comments_insert_member" on circle_comments for insert with check (
  auth.uid() = user_id and
  exists (select 1 from circle_members m where m.circle_id = circle_comments.circle_id and m.user_id = auth.uid())
);
