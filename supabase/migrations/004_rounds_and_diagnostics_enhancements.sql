alter table public.rounds
  add column if not exists holes int;

update public.rounds
set holes = case
  when holes is not null then holes
  when coalesce(par, 72) <= 45 then 9
  else 18
end;

alter table public.rounds
  alter column holes set default 18;

alter table public.rounds
  alter column holes set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rounds_holes_check'
  ) then
    alter table public.rounds
      add constraint rounds_holes_check check (holes in (9, 18));
  end if;
end $$;

alter table public.diagnostics
  add column if not exists recommended_categories text[] not null default '{}';

create unique index if not exists diagnostics_round_unique
  on public.diagnostics (round_id)
  where round_id is not null;
