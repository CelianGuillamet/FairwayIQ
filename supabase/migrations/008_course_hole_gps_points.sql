create table if not exists public.course_hole_gps_points (
  id text primary key,
  course_id text not null references public.golf_courses(id) on delete cascade,
  hole_id text not null references public.course_holes(id) on delete cascade,
  tee_set_id text references public.course_tee_sets(id) on delete set null,
  provider_point_id text,
  hole_number smallint not null check (hole_number between 1 and 54),
  point_type text not null check (
    point_type in (
      'tee',
      'green_front',
      'green_center',
      'green_back',
      'pin',
      'centerline',
      'hazard',
      'bunker',
      'water',
      'layup',
      'poi'
    )
  ),
  name text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  distance_m int check (distance_m is null or distance_m >= 0),
  sort_order int not null default 0,
  source text not null default 'provider',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_hole_gps_points_course_idx
  on public.course_hole_gps_points (course_id, hole_number, sort_order);

create index if not exists course_hole_gps_points_hole_idx
  on public.course_hole_gps_points (hole_id, sort_order);

create index if not exists course_hole_gps_points_type_idx
  on public.course_hole_gps_points (point_type);

alter table public.course_hole_gps_points enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_hole_gps_points'
      and policyname = 'Course hole GPS points are readable'
  ) then
    create policy "Course hole GPS points are readable"
      on public.course_hole_gps_points
      for select
      using (true);
  end if;
end $$;
