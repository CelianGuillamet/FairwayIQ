-- Supabase default privileges grant execute to anon/authenticated on new
-- functions, so `revoke ... from public` in 009 was not enough: any signed-in
-- user could call this RPC through PostgREST and burn another user's quota.
revoke all on function public.increment_course_catalog_rate_limit(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_course_catalog_rate_limit(uuid, timestamptz) to service_role;
