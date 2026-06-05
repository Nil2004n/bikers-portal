-- ═══════════════════════════════════════════════════════════════════════
-- Bikers Portal · follows table + RLS + realtime + views + seed
-- Run this once in the Supabase SQL editor (or via supabase-cli db push).
-- Every statement is idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Table ────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id            uuid        primary key default gen_random_uuid(),
  follower_id   uuid        not null references auth.users(id) on delete cascade,
  following_id  uuid        not null references auth.users(id) on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending','accepted','rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_idx  on public.follows (follower_id, status);
create index if not exists follows_following_idx on public.follows (following_id, status);
create index if not exists follows_pair_idx      on public.follows (follower_id, following_id);

-- touch updated_at on status changes
create or replace function public.bp_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists follows_touch_updated_at on public.follows;
create trigger follows_touch_updated_at
  before update on public.follows
  for each row execute function public.bp_touch_updated_at();

-- ── 2. Row Level Security ──────────────────────────────────────────────
alter table public.follows enable row level security;

drop policy if exists follows_select on public.follows;
create policy follows_select
  on public.follows for select
  to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

drop policy if exists follows_insert on public.follows;
create policy follows_insert
  on public.follows for insert
  to authenticated
  with check (follower_id = auth.uid());

drop policy if exists follows_update on public.follows;
create policy follows_update
  on public.follows for update
  to authenticated
  using (following_id = auth.uid())
  with check (following_id = auth.uid());

drop policy if exists follows_delete on public.follows;
create policy follows_delete
  on public.follows for delete
  to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- ── 3. Realtime ────────────────────────────────────────────────────────
-- `supabase_realtime` publication is created by default on hosted Supabase.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'follows'
  ) then
    execute 'alter publication supabase_realtime add table public.follows';
  end if;
end $$;

-- ── 4. Convenience views ───────────────────────────────────────────────
create or replace view public.follower_counts as
  select following_id as user_id,
         count(*)::int as followers
  from   public.follows
  where  status = 'accepted'
  group  by following_id;

create or replace view public.following_counts as
  select follower_id as user_id,
         count(*)::int as following
  from   public.follows
  where  status = 'accepted'
  group  by follower_id;

-- ── 5. Seed data ───────────────────────────────────────────────────────
-- Five demo users with placeholder password `demo-rider-2025`. All inserts
-- are idempotent (ON CONFLICT DO NOTHING) — re-running won't duplicate.
-- The follow relationships in 5b use email subqueries, so the auth.users
-- rows just need to exist. To sign in as one of these accounts in the
-- app, use the email + the password above.

-- 5a. Provision auth.users + auth.identities + public.profiles for the
--     five demo accounts. Skipped if any rows already exist.

-- Ensure pgcrypto is available for crypt()/gen_salt()
create extension if not exists pgcrypto;

with new_users as (
  insert into auth.users (instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'arjun@bikersportal.app',  crypt('demo-rider-2025', gen_salt('bf')), now(),
     '{"username":"arjun","full_name":"Arjun Iyer","bike_model":"Royal Enfield Interceptor 650","bio":"Demo rider."}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'priya@bikersportal.app',  crypt('demo-rider-2025', gen_salt('bf')), now(),
     '{"username":"priya","full_name":"Priya Sharma","bike_model":"KTM 390 Duke","bio":"Demo rider."}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rohan@bikersportal.app',  crypt('demo-rider-2025', gen_salt('bf')), now(),
     '{"username":"rohan","full_name":"Rohan Mehta","bike_model":"Triumph Bonneville T100","bio":"Demo rider."}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'kavya@bikersportal.app',  crypt('demo-rider-2025', gen_salt('bf')), now(),
     '{"username":"kavya","full_name":"Kavya Reddy","bike_model":"Honda CB350RS","bio":"Demo rider."}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'vikram@bikersportal.app', crypt('demo-rider-2025', gen_salt('bf')), now(),
     '{"username":"vikram","full_name":"Vikram Singh","bike_model":"Bajaj Dominar 400","bio":"Demo rider."}'::jsonb, now(), now())
  on conflict (email) do nothing
  returning id, email
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(),
       nu.id,
       jsonb_build_object('sub', nu.id::text, 'email', nu.email, 'email_verified', true),
       'email',
       nu.email,
       now(),
       now(),
       now()
from   new_users nu
on conflict do nothing;

-- Profiles — one row per demo user, populated from raw_user_meta_data
insert into public.profiles (id, username, full_name, bike_model, bio)
select u.id,
       u.raw_user_meta_data->>'username',
       u.raw_user_meta_data->>'full_name',
       coalesce(u.raw_user_meta_data->>'bike_model', ''),
       coalesce(u.raw_user_meta_data->>'bio', 'Demo rider.')
from   auth.users u
where  u.email in (
  'arjun@bikersportal.app','priya@bikersportal.app','rohan@bikersportal.app',
  'kavya@bikersportal.app','vikram@bikersportal.app'
)
on conflict (id) do nothing;

-- 5b. Ten follow relationships. Mix of accepted + pending so you can
--     exercise every button state (none / pending_sent / pending_received
--     / accepted). Wrapped in a DO block so the script stays safe to
--     re-run: if any demo email is missing from auth.users, the block
--     emits a NOTICE and skips the inserts (no NOT NULL violation).
do $$
declare
  arjun_id  uuid := (select id from auth.users where email = 'arjun@bikersportal.app');
  priya_id  uuid := (select id from auth.users where email = 'priya@bikersportal.app');
  rohan_id  uuid := (select id from auth.users where email = 'rohan@bikersportal.app');
  kavya_id  uuid := (select id from auth.users where email = 'kavya@bikersportal.app');
  vikram_id uuid := (select id from auth.users where email = 'vikram@bikersportal.app');
  missing   text := '';
  inserted  int;
begin
  if arjun_id  is null then missing := missing || ' arjun@bikersportal.app';  end if;
  if priya_id  is null then missing := missing || ' priya@bikersportal.app';  end if;
  if rohan_id  is null then missing := missing || ' rohan@bikersportal.app';  end if;
  if kavya_id  is null then missing := missing || ' kavya@bikersportal.app';  end if;
  if vikram_id is null then missing := missing || ' vikram@bikersportal.app'; end if;

  if missing <> '' then
    raise notice 'Skipping follow seeds — auth.users row(s) missing for:%', missing;
    raise notice 'Re-run this file (block 5a provisions them on first run) or register the demo accounts via the app.';
    return;
  end if;

  insert into public.follows (follower_id, following_id, status)
  select * from (values
    -- mutual accepted pair
    (arjun_id,  priya_id,  'accepted'::text),
    (priya_id,  arjun_id,  'accepted'::text),
    -- one-way accepted
    (arjun_id,  rohan_id,  'accepted'::text),
    (rohan_id,  kavya_id,  'accepted'::text),
    -- pending requests
    (kavya_id,  arjun_id,  'pending'::text),
    (vikram_id, arjun_id,  'pending'::text),
    -- more accepted pairs
    (priya_id,  rohan_id,  'accepted'::text),
    (vikram_id, priya_id,  'accepted'::text),
    (kavya_id,  vikram_id, 'accepted'::text),
    -- one final pending (rohan → vikram)
    (rohan_id,  vikram_id, 'pending'::text)
  ) as p(follower_id, following_id, status)
  on conflict (follower_id, following_id) do nothing;

  get diagnostics inserted = row_count;
  raise notice 'Follow seeds: % row(s) processed (skipped duplicates).', inserted;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Diagnostic queries (commented — uncomment to run in SQL editor)
-- ═══════════════════════════════════════════════════════════════════════

-- All follows in the system
-- select f.created_at,
--        pl.username as follower,   pg.username as following, f.status
-- from   public.follows f
-- join   public.profiles pl on pl.id = f.follower_id
-- join   public.profiles pg on pg.id = f.following_id
-- order  by f.created_at desc;

-- Pending requests targeted at the currently signed-in user
-- select pl.username, pl.full_name, f.created_at
-- from   public.follows f
-- join   public.profiles pl on pl.id = f.follower_id
-- where  f.following_id = auth.uid()
--   and  f.status = 'pending'
-- order  by f.created_at desc;

-- Mutual follows (both directions accepted)
-- with pairs as (
--   select least(follower_id, following_id)   as a,
--          greatest(follower_id, following_id) as b
--   from   public.follows
--   where  status = 'accepted'
--   group  by 1, 2
--   having count(*) = 2
-- )
-- select p1.username as user_a, p2.username as user_b
-- from   pairs p
-- join   public.profiles p1 on p1.id = p.a
-- join   public.profiles p2 on p2.id = p.b;

-- Top 10 users by accepted follower count
-- select p.username, p.full_name, fc.followers
-- from   public.follower_counts fc
-- join   public.profiles p on p.id = fc.user_id
-- order  by fc.followers desc
-- limit  10;

-- ═══════════════════════════════════════════════════════════════════════
-- End of file · Safe to re-run
-- ═══════════════════════════════════════════════════════════════════════
