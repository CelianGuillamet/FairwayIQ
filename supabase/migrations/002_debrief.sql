-- Debrief sessions (one per round)
create table public.debrief_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  round_id uuid references public.rounds(id) on delete cascade not null unique,
  created_at timestamptz not null default now()
);

alter table public.debrief_sessions enable row level security;

create policy "Users can manage their own debrief sessions"
  on public.debrief_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Individual chat messages in a debrief session
create table public.debrief_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.debrief_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.debrief_messages enable row level security;

create policy "Users can manage messages in their sessions"
  on public.debrief_messages for all
  using (
    exists (
      select 1 from public.debrief_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.debrief_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create index debrief_messages_session on public.debrief_messages (session_id, created_at asc);

-- Subscription status (managed by RevenueCat webhook or client SDK)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  is_premium boolean not null default false,
  plan text,  -- 'monthly' | 'annual'
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Auto-create subscription row on signup
create or replace function public.handle_new_user_subscription()
returns trigger as $$
begin
  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();
