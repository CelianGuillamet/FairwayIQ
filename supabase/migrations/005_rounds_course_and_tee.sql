alter table public.rounds
  add column if not exists course_id text,
  add column if not exists tee_key text;

update public.rounds
set tee_key = coalesce(tee_key, 'yellow')
where tee_key is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rounds_tee_key_check'
  ) then
    alter table public.rounds
      add constraint rounds_tee_key_check check (tee_key in ('back', 'white', 'yellow', 'blue', 'red'));
  end if;
end $$;
