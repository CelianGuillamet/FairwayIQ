-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  handicap int not null default 36,
  play_frequency text not null default 'monthly',
  goal text not null default 'lower_handicap',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can manage their own profile"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Rounds
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  played_at timestamptz not null default now(),
  course_name text,
  total_score int not null,
  par int not null default 72,
  putts int,
  gir int,
  fairways_hit int,
  fairways_total int,
  penalties int default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.rounds enable row level security;

create policy "Users can manage their own rounds"
  on public.rounds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index rounds_user_played on public.rounds (user_id, played_at desc);

-- Diagnostics
create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  round_id uuid references public.rounds(id) on delete set null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  weekly_plan text not null default '',
  raw_analysis text not null default '',
  created_at timestamptz not null default now()
);

alter table public.diagnostics enable row level security;

create policy "Users can manage their own diagnostics"
  on public.diagnostics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
