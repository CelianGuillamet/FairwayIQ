-- Badges earned by a player. They are computed on the client from the player's own data:
-- this table only remembers which ones were earned and when, so a badge stays earned after
-- the data behind it changes. The client can read and insert its own rows; with no UPDATE or
-- DELETE policy (and no such grant) it can never edit or take back a badge.
-- Idempotent: safe to re-run, nothing is dropped.
create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_badges'::regclass
      and conname = 'user_badges_user_id_badge_id_key'
  ) then
    alter table public.user_badges
      add constraint user_badges_user_id_badge_id_key unique (user_id, badge_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_badges'::regclass
      and conname = 'user_badges_badge_id_length'
  ) then
    alter table public.user_badges
      add constraint user_badges_badge_id_length
      check (char_length(badge_id) between 1 and 64);
  end if;
end $$;

alter table public.user_badges enable row level security;

revoke all on table public.user_badges from anon, authenticated;
grant select, insert on table public.user_badges to authenticated;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_badges'
      and policyname = 'Users can read their own badges'
  ) then
    alter policy "Users can read their own badges" on public.user_badges
      to authenticated
      using ((select auth.uid()) = user_id);
  else
    create policy "Users can read their own badges"
      on public.user_badges
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_badges'
      and policyname = 'Users can earn their own badges'
  ) then
    alter policy "Users can earn their own badges" on public.user_badges
      to authenticated
      with check ((select auth.uid()) = user_id);
  else
    create policy "Users can earn their own badges"
      on public.user_badges
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;
