-- NOVEX cloud data model for Supabase (PostgreSQL)
-- Run in Supabase SQL Editor. Row-level security keeps each user's projects private.
create table if not exists public.novex_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled project',
  summary text not null default '',
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists novex_projects_user_updated_idx
  on public.novex_projects (user_id, updated_at desc);
alter table public.novex_projects enable row level security;
drop policy if exists "Users can read own NOVEX projects" on public.novex_projects;
create policy "Users can read own NOVEX projects"
  on public.novex_projects for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create own NOVEX projects" on public.novex_projects;
create policy "Users can create own NOVEX projects"
  on public.novex_projects for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own NOVEX projects" on public.novex_projects;
create policy "Users can update own NOVEX projects"
  on public.novex_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own NOVEX projects" on public.novex_projects;
create policy "Users can delete own NOVEX projects"
  on public.novex_projects for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.novex_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at = pg_catalog.now(); return new; end; $$;
drop trigger if exists novex_projects_touch_updated_at on public.novex_projects;
create trigger novex_projects_touch_updated_at before update on public.novex_projects
for each row execute function public.novex_touch_updated_at();
