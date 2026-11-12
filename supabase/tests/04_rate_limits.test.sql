-- Rate limiting (feature 2, criteria 25 and 27).
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- ---------------------------------------------------------------------------
-- hit_rate_limit
-- ---------------------------------------------------------------------------
select is(public.hit_rate_limit('quiz_create', 'subject-a', 2, interval '1 hour'), true, 'first hit is allowed');
select is(public.hit_rate_limit('quiz_create', 'subject-a', 2, interval '1 hour'), true, 'second hit is allowed');
select is(public.hit_rate_limit('quiz_create', 'subject-a', 2, interval '1 hour'), false, 'third hit is over the limit');
select is(public.hit_rate_limit('quiz_create', 'subject-b', 2, interval '1 hour'), true,
  'another subject has its own count');
select is(
  (select window_ends_at - window_start from public.rate_limits where subject = 'subject-a'),
  interval '1 hour',
  'each row records when its window ends'
);

-- ---------------------------------------------------------------------------
-- Clients can't touch the limiter
-- ---------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$select * from public.rate_limits$$, '42501', null, 'members cannot read rate_limits');
select throws_ok($$select public.hit_rate_limit('quiz_create', 'x', 1, interval '1 hour')$$,
  '42501', null, 'members cannot call hit_rate_limit');
reset role;

set local role anon;
select throws_ok($$select public.hit_rate_limit('anon_submit', 'x', 1, interval '1 hour')$$,
  '42501', null, 'anonymous visitors cannot call hit_rate_limit');
reset role;

-- ---------------------------------------------------------------------------
-- 10 new quizzes per member per hour, and failed saves don't count
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to authenticated;
create function tests.quiz(p_title text) returns jsonb language sql as $$
  select jsonb_build_object(
    'kind', 'trivia', 'title', p_title, 'description', '', 'suggested_time_seconds', null,
    'outcomes', '[]'::jsonb,
    'questions', (
      select jsonb_agg(jsonb_build_object(
        'type', 'single_choice', 'prompt', 'Question ' || n,
        'options', '[{"label": "A", "is_correct": true}, {"label": "B", "is_correct": false}]'::jsonb))
      from generate_series(1, 3) as n
    )
  )
$$;
grant execute on function tests.quiz(text) to authenticated;

-- Start from a clean count, in case Alex created quizzes locally this hour.
delete from public.rate_limits where subject = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Two failed saves first: one invalid, one a duplicate title (which fails after the limiter).
select throws_ok($$select public.save_quiz(tests.quiz('ab'))$$, 'P0001', 'invalid_quiz',
  'an invalid quiz is rejected');
select throws_ok($$select public.save_quiz(tests.quiz('World Capitals'))$$, 'P0001', 'duplicate_title',
  'a duplicate title is rejected');

-- Ten creates succeed, then the eleventh is rate limited.
select lives_ok(
  $$select public.save_quiz(tests.quiz('Rate limit quiz ' || n)) from generate_series(1, 10) as n$$,
  'ten new quizzes in an hour are allowed, even after two failed saves'
);
reset role;


set local role authenticated;
select throws_ok($$select public.save_quiz(tests.quiz('Rate limit quiz 11'))$$, 'P0001', 'rate_limited',
  'the eleventh new quiz in an hour is rate limited');

-- Edits are not limited.
select lives_ok(
  $$select public.save_quiz(tests.quiz('World Capitals')
      || '{"id": "a0000000-0000-4000-8000-000000000001", "expected_version": 1}')$$,
  'editing is not rate limited'
);
reset role;

select * from finish();
rollback;
