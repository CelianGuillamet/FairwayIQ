-- Atomic round persistence.
-- save_round / update_round write a round and its holes in a single transaction,
-- so a failed holes insert can no longer leave an orphan round behind, and an edit
-- can no longer leave aggregates and holes out of sync.
--
-- Both functions are SECURITY INVOKER: RLS and the owner triggers from 007 still apply.
-- user_id is always auth.uid(); it is never read from the payload.

alter table public.rounds
  add column if not exists client_request_id uuid;

-- Idempotency key: a client retry of the same save (e.g. after a timeout) returns the
-- already-saved round instead of inserting a duplicate.
create unique index if not exists rounds_user_client_request_id_key
  on public.rounds (user_id, client_request_id)
  where client_request_id is not null;

create or replace function public.save_round(p_round jsonb, p_holes jsonb)
returns public.rounds
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_round public.rounds;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_round is null or jsonb_typeof(p_round) <> 'object' then
    raise exception 'p_round must be a json object' using errcode = '22023';
  end if;

  if p_holes is null or jsonb_typeof(p_holes) <> 'array' then
    raise exception 'p_holes must be a json array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_holes) is distinct from (p_round->>'holes')::int then
    raise exception 'p_holes must contain exactly one entry per hole' using errcode = '22023';
  end if;

  v_request_id := (p_round->>'client_request_id')::uuid;

  insert into public.rounds (
    user_id,
    client_request_id,
    played_at,
    course_id,
    course_name,
    course_provider,
    provider_course_id,
    tee_key,
    tee_set_id,
    tee_name,
    tee_color,
    holes,
    total_score,
    par,
    putts,
    gir,
    fairways_hit,
    fairways_total,
    penalties,
    notes
  )
  values (
    v_user_id,
    v_request_id,
    coalesce((p_round->>'played_at')::timestamptz, now()),
    p_round->>'course_id',
    p_round->>'course_name',
    p_round->>'course_provider',
    p_round->>'provider_course_id',
    p_round->>'tee_key',
    p_round->>'tee_set_id',
    p_round->>'tee_name',
    p_round->>'tee_color',
    (p_round->>'holes')::int,
    (p_round->>'total_score')::int,
    (p_round->>'par')::int,
    (p_round->>'putts')::int,
    (p_round->>'gir')::int,
    (p_round->>'fairways_hit')::int,
    (p_round->>'fairways_total')::int,
    (p_round->>'penalties')::int,
    p_round->>'notes'
  )
  on conflict (user_id, client_request_id) where client_request_id is not null do nothing
  returning * into v_round;

  if not found then
    select *
      into v_round
      from public.rounds
     where user_id = v_user_id
       and client_request_id = v_request_id;

    return v_round;
  end if;

  insert into public.round_holes (
    round_id,
    user_id,
    hole_number,
    par,
    score,
    putts,
    gir,
    fairway_hit,
    penalty
  )
  select
    v_round.id,
    v_user_id,
    (h->>'hole_number')::int,
    (h->>'par')::int,
    (h->>'score')::int,
    (h->>'putts')::int,
    (h->>'gir')::boolean,
    (h->>'fairway_hit')::boolean,
    coalesce((h->>'penalty')::int, 0)
  from jsonb_array_elements(p_holes) as h;

  return v_round;
end;
$$;

-- p_holes null: metadata-only update (course_name, notes); aggregate keys are rejected.
-- p_holes array: replaces every hole of the round; p_round must then carry total_score
-- and par, and any other aggregate key present is applied as well.
create or replace function public.update_round(
  p_round_id uuid,
  p_round jsonb,
  p_holes jsonb default null
)
returns public.rounds
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.rounds;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_round_id is null then
    raise exception 'p_round_id is required' using errcode = '22023';
  end if;

  if p_round is null or jsonb_typeof(p_round) <> 'object' then
    raise exception 'p_round must be a json object' using errcode = '22023';
  end if;

  if p_holes is not null and jsonb_typeof(p_holes) <> 'array' then
    raise exception 'p_holes must be a json array' using errcode = '22023';
  end if;

  if p_holes is null and (
    p_round ? 'total_score' or p_round ? 'par' or p_round ? 'putts' or p_round ? 'gir'
    or p_round ? 'fairways_hit' or p_round ? 'fairways_total' or p_round ? 'penalties'
  ) then
    raise exception 'aggregates can only be updated together with p_holes' using errcode = '22023';
  end if;

  if p_holes is not null and not (p_round ? 'total_score' and p_round ? 'par') then
    raise exception 'p_round must carry total_score and par when p_holes is provided'
      using errcode = '22023';
  end if;

  select *
    into v_round
    from public.rounds
   where id = p_round_id
     and user_id = v_user_id
   for update;

  if not found then
    raise exception 'round not found' using errcode = 'P0002';
  end if;

  if p_holes is not null and jsonb_array_length(p_holes) <> v_round.holes then
    raise exception 'p_holes must contain exactly one entry per hole' using errcode = '22023';
  end if;

  update public.rounds r
     set course_name    = case when p_round ? 'course_name'    then p_round->>'course_name'             else r.course_name end,
         notes          = case when p_round ? 'notes'          then p_round->>'notes'                   else r.notes end,
         total_score    = case when p_round ? 'total_score'    then (p_round->>'total_score')::int      else r.total_score end,
         par            = case when p_round ? 'par'            then (p_round->>'par')::int              else r.par end,
         putts          = case when p_round ? 'putts'          then (p_round->>'putts')::int            else r.putts end,
         gir            = case when p_round ? 'gir'            then (p_round->>'gir')::int              else r.gir end,
         fairways_hit   = case when p_round ? 'fairways_hit'   then (p_round->>'fairways_hit')::int     else r.fairways_hit end,
         fairways_total = case when p_round ? 'fairways_total' then (p_round->>'fairways_total')::int   else r.fairways_total end,
         penalties      = case when p_round ? 'penalties'      then (p_round->>'penalties')::int        else r.penalties end
   where r.id = p_round_id
     and r.user_id = v_user_id
  returning r.* into v_round;

  if p_holes is not null then
    delete from public.round_holes
     where round_id = p_round_id
       and user_id = v_user_id;

    insert into public.round_holes (
      round_id,
      user_id,
      hole_number,
      par,
      score,
      putts,
      gir,
      fairway_hit,
      penalty
    )
    select
      p_round_id,
      v_user_id,
      (h->>'hole_number')::int,
      (h->>'par')::int,
      (h->>'score')::int,
      (h->>'putts')::int,
      (h->>'gir')::boolean,
      (h->>'fairway_hit')::boolean,
      coalesce((h->>'penalty')::int, 0)
    from jsonb_array_elements(p_holes) as h;
  end if;

  return v_round;
end;
$$;

-- Supabase default privileges grant execute to anon/authenticated on new functions,
-- so access is reset explicitly: only signed-in users may call these RPCs.
revoke all on function public.save_round(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_round(jsonb, jsonb) to authenticated;

revoke all on function public.update_round(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_round(uuid, jsonb, jsonb) to authenticated;
