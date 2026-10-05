-- Manual carry distances ("Mon sac"): one row per player and club, in meters.
-- updated_at is set by the client on every upsert, there is no trigger.
create table if not exists public.club_distances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club text not null,
  carry_m smallint not null,
  updated_at timestamptz not null default now(),
  constraint club_distances_user_club_key unique (user_id, club),
  constraint club_distances_club_check check (club in (
    'driver', 'wood3', 'wood5', 'hybrid',
    'iron4', 'iron5', 'iron6', 'iron7', 'iron8', 'iron9',
    'pw', 'gw', 'sw', 'lw'
  )),
  constraint club_distances_carry_m_check check (carry_m between 10 and 400)
);

alter table public.club_distances enable row level security;

grant select, insert, update, delete on public.club_distances to authenticated;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'club_distances'
      and policyname = 'Users can manage their own club distances'
  ) then
    alter policy "Users can manage their own club distances" on public.club_distances
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  else
    create policy "Users can manage their own club distances"
      on public.club_distances
      for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;
