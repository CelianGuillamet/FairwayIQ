-- Data integrity and RLS hardening.
-- Client-side validation is not a security boundary. These constraints keep
-- user-owned child rows attached to rounds owned by the same user and tighten
-- common value ranges at the database layer.

create or replace function public.enforce_round_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.round_id is not null and not exists (
    select 1
    from public.rounds
    where id = new.round_id
      and user_id = new.user_id
  ) then
    raise exception 'round_id must belong to the same user_id'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_round_holes_owner on public.round_holes;
create trigger enforce_round_holes_owner
  before insert or update of round_id, user_id
  on public.round_holes
  for each row execute function public.enforce_round_owner();

drop trigger if exists enforce_diagnostics_round_owner on public.diagnostics;
create trigger enforce_diagnostics_round_owner
  before insert or update of round_id, user_id
  on public.diagnostics
  for each row execute function public.enforce_round_owner();

drop trigger if exists enforce_debrief_sessions_round_owner on public.debrief_sessions;
create trigger enforce_debrief_sessions_round_owner
  before insert or update of round_id, user_id
  on public.debrief_sessions
  for each row execute function public.enforce_round_owner();

do $$
begin
  if exists (
    select 1
    from public.round_holes h
    left join public.rounds r
      on r.id = h.round_id
     and r.user_id = h.user_id
    where r.id is null
  ) then
    raise exception 'Existing round_holes contain rows whose round_id does not belong to user_id';
  end if;

  if exists (
    select 1
    from public.diagnostics d
    left join public.rounds r
      on r.id = d.round_id
     and r.user_id = d.user_id
    where d.round_id is not null
      and r.id is null
  ) then
    raise exception 'Existing diagnostics contain rows whose round_id does not belong to user_id';
  end if;

  if exists (
    select 1
    from public.debrief_sessions s
    left join public.rounds r
      on r.id = s.round_id
     and r.user_id = s.user_id
    where r.id is null
  ) then
    raise exception 'Existing debrief_sessions contain rows whose round_id does not belong to user_id';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_handicap_range'
  ) then
    alter table public.profiles
      add constraint profiles_handicap_range check (handicap between 0 and 54);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_play_frequency_check'
  ) then
    alter table public.profiles
      add constraint profiles_play_frequency_check
      check (play_frequency in ('monthly', 'biweekly', 'weekly', 'frequent'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_goal_check'
  ) then
    alter table public.profiles
      add constraint profiles_goal_check
      check (goal in ('lower_handicap', 'consistency', 'short_game', 'putting', 'enjoyment'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_score_range'
  ) then
    alter table public.rounds
      add constraint rounds_score_range
      check (total_score between holes and holes * 15);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_par_range'
  ) then
    alter table public.rounds
      add constraint rounds_par_range check (
        (holes = 9 and par between 27 and 54)
        or (holes = 18 and par between 54 and 108)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_putts_range'
  ) then
    alter table public.rounds
      add constraint rounds_putts_range check (
        putts is null or putts between 0 and holes * 6
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_gir_range'
  ) then
    alter table public.rounds
      add constraint rounds_gir_range check (
        gir is null or gir between 0 and holes
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_fairways_range'
  ) then
    alter table public.rounds
      add constraint rounds_fairways_range check (
        fairways_total is null
        or (
          fairways_total between 0 and holes
          and coalesce(fairways_hit, 0) between 0 and fairways_total
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rounds_penalties_range'
  ) then
    alter table public.rounds
      add constraint rounds_penalties_range check (
        penalties is null or penalties between 0 and holes * 5
      );
  end if;
end $$;

drop policy if exists "Users can manage their own profile" on public.profiles;
create policy "Users can manage their own profile"
  on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own rounds" on public.rounds;
create policy "Users can manage their own rounds"
  on public.rounds
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own diagnostics" on public.diagnostics;
create policy "Users can manage their own diagnostics"
  on public.diagnostics
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own round holes" on public.round_holes;
create policy "Users can manage their own round holes"
  on public.round_holes
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own debrief sessions" on public.debrief_sessions;
create policy "Users can manage their own debrief sessions"
  on public.debrief_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage messages in their sessions" on public.debrief_messages;
create policy "Users can manage messages in their sessions"
  on public.debrief_messages
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.debrief_sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.debrief_sessions s
      where s.id = session_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
