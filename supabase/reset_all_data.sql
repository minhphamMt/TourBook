-- Reset all application data for the TourBook / The Horizon demo database.
-- DANGER: only run on a development or testing Supabase project.
-- Recommended order:
-- 1. supabase/reset_all_data.sql
-- 2. supabase/seed_showcase.sql

begin;

-- Truncate every table in the public schema.
do $$
declare
  public_stmt text;
begin
  select
    'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename) || ' restart identity cascade'
  into public_stmt
  from pg_tables
  where schemaname = 'public';

  if public_stmt is not null then
    execute public_stmt;
  end if;
end $$;

-- Remove all auth users and related login/session data that may exist on this dev database.
do $$
declare
  auth_stmt text;
begin
  select
    'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename) || ' cascade'
  into auth_stmt
  from pg_tables
  where schemaname = 'auth'
    and tablename in (
      'flow_state',
      'identities',
      'one_time_tokens',
      'refresh_tokens',
      'sessions',
      'users'
    );

  if auth_stmt is not null then
    execute auth_stmt;
  end if;
end $$;

commit;

