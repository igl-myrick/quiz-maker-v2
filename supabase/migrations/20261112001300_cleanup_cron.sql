-- Scheduled cleanup (ARCHITECTURE_SPEC.md 7.3, CLAUDE.md section 6, feature 1 criterion 18).
-- Every 15 minutes, delete:
--   - anonymous results past their 1-day expiry
--   - rate-limiter rows whose window has ended
--   - retired quiz versions older than 24 hours
-- The deletes live in a function so the database tests can call them directly.

create function public.cleanup_expired()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.results where owner_id is null and expires_at <= now();
  delete from public.rate_limits where window_ends_at <= now();
  delete from public.quiz_versions where retired_at <= now() - interval '24 hours';
$$;

revoke execute on function public.cleanup_expired() from public, anon, authenticated, service_role;

create extension if not exists pg_cron;

-- Scheduling by name replaces any existing job with that name, so this is safe to rerun.
select cron.schedule('cleanup-expired', '*/15 * * * *', 'select public.cleanup_expired();');
