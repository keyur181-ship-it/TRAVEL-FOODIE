-- =====================================================================
-- Travel Foodie India — multi-user database schema
-- Run this in your Supabase project:  SQL Editor → New query → paste → Run
-- =====================================================================

-- One row per saved place. `added_by` records WHO created it, which is
-- what lets us show "Delete" only to the author (enforced below by RLS).
create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  added_by   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  area       text,
  location   text,
  lat        double precision,
  lng        double precision,
  photo      text,                      -- compressed JPEG data URL (v1)
  rating     int  default 0 check (rating between 0 and 5),
  review     text,
  items      jsonb not null default '[]'::jsonb,  -- [{name, rating, note}]
  created_at timestamptz not null default now()
);

create index if not exists places_created_at_idx on public.places (created_at desc);

-- =====================================================================
-- Row-Level Security: the database itself enforces who can do what.
-- This is the real protection — not just hiding a button in the app.
-- =====================================================================
alter table public.places enable row level security;

-- Everyone can READ all places (so people can browse, even before login).
drop policy if exists "places readable by everyone" on public.places;
create policy "places readable by everyone"
  on public.places for select
  using (true);

-- Only a logged-in user can ADD a place, and only as themselves.
drop policy if exists "users add their own places" on public.places;
create policy "users add their own places"
  on public.places for insert
  to authenticated
  with check (auth.uid() = added_by);

-- Only the AUTHOR can edit their place.
drop policy if exists "authors update their own places" on public.places;
create policy "authors update their own places"
  on public.places for update
  to authenticated
  using (auth.uid() = added_by)
  with check (auth.uid() = added_by);

-- Only the AUTHOR can delete their place.  <-- this is your requested rule.
drop policy if exists "authors delete their own places" on public.places;
create policy "authors delete their own places"
  on public.places for delete
  to authenticated
  using (auth.uid() = added_by);
