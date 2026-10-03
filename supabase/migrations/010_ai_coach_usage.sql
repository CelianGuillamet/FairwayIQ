-- Tracks per-user daily calls to the ai-coach edge function so it can enforce
-- a daily limit (free vs premium) and cap the cost of the paid AI provider.

create table if not exists public.ai_coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  call_count int not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_coach_usage enable row level security;

-- Internal counter: only read and written by the ai-coach edge function via
-- the service role, which bypasses RLS. No policy is defined, so no
-- anon/authenticated client can read or write it directly.

create or replace function public.increment_ai_coach_usage(
  p_user_id uuid,
  p_usage_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call_count int;
begin
  insert into public.ai_coach_usage (user_id, usage_date, call_count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date)
  do update set
    call_count = public.ai_coach_usage.call_count + 1
  returning call_count into v_call_count;

  return v_call_count;
end;
$$;

-- Supabase default privileges grant execute to anon/authenticated on new
-- functions, so they are revoked explicitly: otherwise any signed-in user
-- could burn another user's daily quota through PostgREST.
revoke all on function public.increment_ai_coach_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.increment_ai_coach_usage(uuid, date) to service_role;
