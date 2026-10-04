-- event_timestamp_ms of the last RevenueCat event applied to this row. The
-- webhook ignores older events so a replayed EXPIRATION cannot revoke premium
-- granted by a later RENEWAL.
alter table public.subscriptions
  add column if not exists last_event_at timestamptz;

-- Single atomic write path for the revenuecat-webhook Edge Function.
-- Returns 'applied', 'ignored' (older event, or an older expiry when
-- p_ignore_older_expiry is set) or 'unknown_user' (account already deleted).
create or replace function public.apply_subscription_event(
  p_user_id uuid,
  p_is_premium boolean,
  p_plan text,
  p_expires_at timestamptz,
  p_event_at timestamptz,
  p_ignore_older_expiry boolean default false
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  insert into public.subscriptions as s (user_id, is_premium, plan, expires_at, last_event_at, updated_at)
  values (p_user_id, p_is_premium, p_plan, p_expires_at, p_event_at, now())
  on conflict (user_id) do update
    set is_premium = excluded.is_premium,
        plan = excluded.plan,
        expires_at = excluded.expires_at,
        last_event_at = coalesce(excluded.last_event_at, s.last_event_at),
        updated_at = now()
    where (p_event_at is null or s.last_event_at is null or s.last_event_at <= p_event_at)
      and (
        not p_ignore_older_expiry
        or p_expires_at is null
        or s.expires_at is null
        or s.expires_at <= p_expires_at
      );

  get diagnostics v_rows = row_count;

  return case when v_rows > 0 then 'applied' else 'ignored' end;
exception
  when foreign_key_violation then
    return 'unknown_user';
end;
$$;

-- Supabase default privileges grant execute to anon/authenticated on new
-- functions; only the webhook (service role) may call this one.
revoke all on function public.apply_subscription_event(uuid, boolean, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, boolean, text, timestamptz, timestamptz, boolean) to service_role;
