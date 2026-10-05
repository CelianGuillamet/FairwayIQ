-- Optional result of a drill session, stored with its completion: result_made out of
-- result_attempts (balls, putts or holes). Both stay null when the player skips the result.
-- Rows are written once at completion time, so no new policy is needed: the existing
-- "Users can manage their own drill completions" policy already restricts every
-- operation, including a later update, to the row's owner.
alter table public.drill_completions
  add column if not exists result_made smallint,
  add column if not exists result_attempts smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drill_completions'::regclass
      and conname = 'drill_completions_result_made_nonneg'
  ) then
    alter table public.drill_completions
      add constraint drill_completions_result_made_nonneg
      check (result_made >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drill_completions'::regclass
      and conname = 'drill_completions_result_attempts_positive'
  ) then
    alter table public.drill_completions
      add constraint drill_completions_result_attempts_positive
      check (result_attempts > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drill_completions'::regclass
      and conname = 'drill_completions_result_made_within_attempts'
  ) then
    alter table public.drill_completions
      add constraint drill_completions_result_made_within_attempts
      check (result_made <= result_attempts);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.drill_completions'::regclass
      and conname = 'drill_completions_result_both_or_none'
  ) then
    alter table public.drill_completions
      add constraint drill_completions_result_both_or_none
      check ((result_made is null) = (result_attempts is null));
  end if;
end $$;
