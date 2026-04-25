create table if not exists public.golf_courses (
  id text primary key,
  provider text not null,
  provider_course_id text not null,
  provider_club_id text,
  name text not null,
  club_name text,
  city text,
  region text,
  state text,
  country text,
  country_code text,
  latitude double precision,
  longitude double precision,
  holes smallint not null check (holes between 1 and 54),
  par18 int,
  par9 int,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_course_id)
);

create table if not exists public.course_tee_sets (
  id text primary key,
  course_id text not null references public.golf_courses(id) on delete cascade,
  provider_tee_set_id text,
  key text not null,
  name text not null,
  short_label text,
  color text,
  gender text,
  total_distance_m int,
  course_rating numeric(4, 1),
  slope_rating int,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, key)
);

create table if not exists public.course_holes (
  id text primary key,
  course_id text not null references public.golf_courses(id) on delete cascade,
  hole_number smallint not null check (hole_number between 1 and 54),
  par smallint not null check (par between 3 and 6),
  handicap_index smallint,
  latitude double precision,
  longitude double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, hole_number)
);

create table if not exists public.course_hole_tee_distances (
  hole_id text not null references public.course_holes(id) on delete cascade,
  tee_set_id text not null references public.course_tee_sets(id) on delete cascade,
  distance_m int not null check (distance_m > 0),
  created_at timestamptz not null default now(),
  primary key (hole_id, tee_set_id)
);

create index if not exists golf_courses_name_idx on public.golf_courses (lower(name));
create index if not exists golf_courses_club_name_idx on public.golf_courses (lower(club_name));
create index if not exists golf_courses_city_idx on public.golf_courses (lower(city));
create index if not exists golf_courses_provider_course_id_idx on public.golf_courses (provider, provider_course_id);
create index if not exists course_tee_sets_course_id_idx on public.course_tee_sets (course_id, sort_order);
create index if not exists course_holes_course_id_idx on public.course_holes (course_id, hole_number);
create index if not exists course_hole_tee_distances_tee_set_id_idx on public.course_hole_tee_distances (tee_set_id);

alter table public.golf_courses enable row level security;
alter table public.course_tee_sets enable row level security;
alter table public.course_holes enable row level security;
alter table public.course_hole_tee_distances enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'golf_courses'
      and policyname = 'Golf courses are readable'
  ) then
    create policy "Golf courses are readable"
      on public.golf_courses
      for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_tee_sets'
      and policyname = 'Course tee sets are readable'
  ) then
    create policy "Course tee sets are readable"
      on public.course_tee_sets
      for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_holes'
      and policyname = 'Course holes are readable'
  ) then
    create policy "Course holes are readable"
      on public.course_holes
      for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_hole_tee_distances'
      and policyname = 'Course hole tee distances are readable'
  ) then
    create policy "Course hole tee distances are readable"
      on public.course_hole_tee_distances
      for select
      using (true);
  end if;
end $$;

alter table public.rounds
  add column if not exists course_provider text,
  add column if not exists provider_course_id text,
  add column if not exists tee_set_id text,
  add column if not exists tee_name text,
  add column if not exists tee_color text;

alter table public.rounds
  alter column tee_key drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'rounds_tee_key_check'
  ) then
    alter table public.rounds
      drop constraint rounds_tee_key_check;
  end if;
end $$;

update public.rounds
set tee_name = coalesce(tee_name, tee_key)
where tee_name is null
  and tee_key is not null;
