-- Fixed-window rate limiting (ARCHITECTURE_SPEC.md 4.7 and 7.1).
-- Feature 2 uses the quiz_create scope. Feature 1 uses the two submit scopes
-- and adds the cron job that deletes rows once their window has ended.

create type public.rate_limit_scope as enum ('anon_submit', 'member_submit', 'quiz_create');

create table public.rate_limits (
  scope public.rate_limit_scope not null,
  -- anon_submit: a salted hash of the IP. Other scopes: the member's user ID.
  subject text not null,
  window_start timestamptz not null,
  window_ends_at timestamptz not null,
  count int not null,
  primary key (scope, subject, window_start)
);

create index rate_limits_window_ends_idx on public.rate_limits (window_ends_at);

-- No client may read or write this table. Only hit_rate_limit touches it.
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated, service_role;

-- Counts one hit for this subject in the current fixed window (for example 14:00-15:00
-- for a one-hour window) and returns whether it is still within the limit.
-- One atomic upsert, so two requests at the same moment can't both slip through.
create function public.hit_rate_limit(
  p_scope public.rate_limit_scope,
  p_subject text,
  p_max int,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz := date_bin(p_window, now(), timestamptz '1970-01-01 00:00:00+00');
  v_count int;
begin
  insert into public.rate_limits as r (scope, subject, window_start, window_ends_at, count)
  values (p_scope, p_subject, v_window_start, v_window_start + p_window, 1)
  on conflict (scope, subject, window_start)
    do update set count = r.count + 1
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke execute on function public.hit_rate_limit(public.rate_limit_scope, text, int, interval)
  from public, anon, authenticated;
grant execute on function public.hit_rate_limit(public.rate_limit_scope, text, int, interval)
  to service_role;
