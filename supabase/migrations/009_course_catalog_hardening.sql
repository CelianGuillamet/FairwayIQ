-- Hardens the course-catalog edge function against cost/abuse drift from the
-- external golf course providers (golfapi.io, OpenStreetMap Overpass):
-- caches "not found" lookups so they are not retried against the external
-- API on every request, and tracks a per-user request counter so the
-- function can enforce a basic rate limit.

create table if not exists public.course_catalog_negative_cache (
  id text primary key,
  lookup_type text not null check (lookup_type in ('search', 'course')),
  provider text not null,
  cache_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists course_catalog_negative_cache_expires_at_idx
  on public.course_catalog_negative_cache (expires_at);

alter table public.course_catalog_negative_cache enable row level security;

-- Internal cache: only read and written by the course-catalog edge function
-- via the service role, which bypasses RLS. No policy is defined, so no
-- anon/authenticated client can read or write it directly.

create table if not exists public.course_catalog_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, window_start)
);

create index if not exists course_catalog_rate_limits_window_idx
  on public.course_catalog_rate_limits (window_start);

alter table public.course_catalog_rate_limits enable row level security;

-- Internal counter: only read and written by the course-catalog edge
-- function via the service role. No policy is defined, so no
-- anon/authenticated client can read or write it directly.

create or replace function public.increment_course_catalog_rate_limit(
  p_user_id uuid,
  p_window_start timestamptz
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_count int;
begin
  insert into public.course_catalog_rate_limits (user_id, window_start, request_count, updated_at)
  values (p_user_id, p_window_start, 1, now())
  on conflict (user_id, window_start)
  do update set
    request_count = public.course_catalog_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_request_count;

  return v_request_count;
end;
$$;

revoke all on function public.increment_course_catalog_rate_limit(uuid, timestamptz) from public;
grant execute on function public.increment_course_catalog_rate_limit(uuid, timestamptz) to service_role;
