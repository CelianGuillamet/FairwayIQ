do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.diagnostics'::regclass
      and conname = 'diagnostics_round_id_key'
  ) then
    alter table public.diagnostics
      add constraint diagnostics_round_id_key unique (round_id);
  end if;
end $$;
