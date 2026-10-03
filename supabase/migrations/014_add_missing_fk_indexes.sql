-- Covering indexes for foreign keys flagged by the Supabase performance advisor.
create index if not exists diagnostics_user_created
  on public.diagnostics (user_id, created_at desc);

create index if not exists debrief_sessions_user
  on public.debrief_sessions (user_id);

create index if not exists course_hole_gps_points_tee_set_idx
  on public.course_hole_gps_points (tee_set_id);
