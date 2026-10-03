-- drill_completions existed in production (created outside the tracked migrations)
-- but was never versioned. Idempotent so it is a no-op where the table already exists.
create table if not exists public.drill_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drill_id text not null,
  completed_at timestamptz not null default now()
);

create index if not exists drill_completions_user
  on public.drill_completions (user_id, completed_at desc);

alter table public.drill_completions enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'drill_completions'
      and policyname = 'Users can manage their own drill completions'
  ) then
    alter policy "Users can manage their own drill completions" on public.drill_completions
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  else
    create policy "Users can manage their own drill completions"
      on public.drill_completions
      for all
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;
