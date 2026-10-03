-- handle_new_user* are trigger functions: Postgres only checks EXECUTE when the
-- trigger is created, so revoking it removes the PostgREST RPC exposure
-- (anon/authenticated could call them via /rest/v1/rpc) without affecting signup.
alter function public.handle_new_user() set search_path = public;
alter function public.handle_new_user_subscription() set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_user_subscription() from public, anon, authenticated;
