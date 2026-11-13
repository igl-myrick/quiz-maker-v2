-- cleanup_expired, the cron job, result timing and the submission rate-limit scopes
-- (feature 1, criterion 19).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ---------------------------------------------------------------------------
-- cleanup_expired removes only rows past their limits
-- ---------------------------------------------------------------------------
insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at, claim_token_hash)
values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'Old', '{}', 1,
   now() - interval '1 minute', 'hash'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'New', '{}', 1,
   now() + interval '1 hour', 'hash');
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score)
values ('e0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'Owned', '{}', 1);

insert into public.rate_limits (scope, subject, window_start, window_ends_at, count)
values
  ('anon_submit', 'ended', now() - interval '2 hours', now() - interval '1 hour', 3),
  ('anon_submit', 'current', now() - interval '10 minutes', now() + interval '50 minutes', 3);

insert into public.quiz_versions (quiz_id, version, snapshot, retired_at)
values
  ('f0000000-0000-4000-8000-000000000001', 1, '{}', now() - interval '25 hours'),
  ('f0000000-0000-4000-8000-000000000002', 1, '{}', now() - interval '23 hours');

select public.cleanup_expired();

select is(
  (select array_agg(quiz_title order by quiz_title) from public.results
   where id::text like 'e0000000%'),
  array['New', 'Owned'],
  'expired anonymous results are deleted; unexpired and owned results stay'
);
select is(
  (select array_agg(subject) from public.rate_limits where subject in ('ended', 'current')),
  array['current'],
  'rate-limit rows are deleted once their window has ended'
);
select is(
  (select array_agg(quiz_id::text) from public.quiz_versions where quiz_id::text like 'f0000000%'),
  array['f0000000-0000-4000-8000-000000000002'],
  'retired versions are deleted after 24 hours'
);

set local role anon;
select throws_ok('select public.cleanup_expired()', '42501', null, 'anonymous visitors cannot run the cleanup');
reset role;
set local role authenticated;
select throws_ok('select public.cleanup_expired()', '42501', null, 'members cannot run the cleanup');
reset role;
set local role service_role;
select throws_ok('select public.cleanup_expired()', '42501', null, 'edge functions cannot run the cleanup');
reset role;

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'cleanup-expired'),
  '*/15 * * * * select public.cleanup_expired();',
  'the cleanup runs every 15 minutes'
);

-- ---------------------------------------------------------------------------
-- Results record timed takes, and get_result returns them
-- ---------------------------------------------------------------------------
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, timed, duration_seconds)
values ('e0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'Timed', '{}', 1, true, 245);

select is(
  public.get_result('e0000000-0000-4000-8000-000000000004') -> 'result' -> 'timed', 'true'::jsonb,
  'get_result returns whether the take was timed'
);
select is(
  public.get_result('e0000000-0000-4000-8000-000000000004') -> 'result' -> 'duration_seconds', '245'::jsonb,
  'get_result returns the duration'
);
select is(
  public.get_result('e0000000-0000-4000-8000-000000000003') -> 'result' -> 'timed', 'false'::jsonb,
  'untimed results say so'
);
select throws_ok(
  $$insert into public.results (owner_id, quiz_version, quiz_kind, quiz_title, snapshot, score, duration_seconds)
    values ('11111111-1111-4111-8111-111111111111', 1, 'trivia', 'x', '{}', 1, -1)$$,
  '23514', null, 'a duration cannot be negative'
);

-- ---------------------------------------------------------------------------
-- The submission scopes count separately per subject
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(public.hit_rate_limit('member_submit', 'member-a', 2, interval '1 hour'))
   from generate_series(1, 3)),
  array[true, true, false],
  'member submissions are limited per member'
);
select is(public.hit_rate_limit('member_submit', 'member-b', 2, interval '1 hour'), true,
  'another member has their own count');
select is(
  (select array_agg(public.hit_rate_limit('anon_submit', 'ip-hash-a', 2, interval '1 hour'))
   from generate_series(1, 3)),
  array[true, true, false],
  'anonymous submissions are limited per connection'
);
select is(public.hit_rate_limit('anon_submit', 'member-a', 2, interval '1 hour'), true,
  'the anonymous and member scopes are counted separately');

select * from finish();
rollback;
