create table public.round_holes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null check (par between 3 and 6),
  score int not null check (score between 1 and 15),
  putts int check (putts between 0 and 6),
  gir boolean,
  fairway_hit boolean,
  penalty int not null default 0 check (penalty between 0 and 5),
  created_at timestamptz not null default now(),
  unique (round_id, hole_number)
);

alter table public.round_holes enable row level security;

create policy "Users can manage their own round holes"
  on public.round_holes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index round_holes_round on public.round_holes (round_id, hole_number asc);
create index round_holes_user_created on public.round_holes (user_id, created_at desc);
