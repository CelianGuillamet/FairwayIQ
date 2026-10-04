-- Catalog read policies were created for the public role (anon included) with
-- "using (true)", so anyone holding the anon key could scrape the whole
-- catalog straight from PostgREST. The app only reads it while signed in, and
-- the course-catalog edge function uses the service role, so reads are
-- restricted to authenticated users. ALTER POLICY keeps each policy in place
-- (never absent) and can safely be re-run.

do $$
declare
  v_policy record;
begin
  for v_policy in
    select *
    from (values
      ('golf_courses', 'Golf courses are readable'),
      ('course_tee_sets', 'Course tee sets are readable'),
      ('course_holes', 'Course holes are readable'),
      ('course_hole_tee_distances', 'Course hole tee distances are readable'),
      ('course_hole_gps_points', 'Course hole GPS points are readable')
    ) as policies(table_name, policy_name)
  loop
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_policy.table_name
        and policyname = v_policy.policy_name
    ) then
      execute format(
        'alter policy %I on public.%I to authenticated',
        v_policy.policy_name,
        v_policy.table_name
      );
    else
      raise warning 'Policy "%" not found on public.%, skipped', v_policy.policy_name, v_policy.table_name;
    end if;
  end loop;
end $$;

-- Gives back the daily ai-coach call consumed by a request whose provider call
-- failed. Same internal-only grants as increment_ai_coach_usage (010): without
-- the explicit revoke, any signed-in user could call it through PostgREST.

create or replace function public.refund_ai_coach_usage(
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
  update public.ai_coach_usage
  set call_count = greatest(call_count - 1, 0)
  where user_id = p_user_id
    and usage_date = p_usage_date
  returning call_count into v_call_count;

  return coalesce(v_call_count, 0);
end;
$$;

revoke all on function public.refund_ai_coach_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.refund_ai_coach_usage(uuid, date) to service_role;
