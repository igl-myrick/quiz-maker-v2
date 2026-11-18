-- get_my_dashboard_summary (feature 7, P5.1 and P5.2).
-- Alex is 11111111-…, Sam is 22222222-…. These are the seed's only members.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Alex: two trivia results (0.5 and 1) and one personality result.
-- Sam: one personality result. One anonymous trivia result, which has no owner.
-- ---------------------------------------------------------------------------
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, outcome_ranking)
values
  ('b0000000-0000-4000-8000-000000000101', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'World Capitals',
   '{"questions": [{}, {}]}', 0.5, null),
  ('b0000000-0000-4000-8000-000000000102', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000002', 1, 'trivia', 'The Solar System',
   '{"questions": [{}, {}]}', 1, null),
  ('b0000000-0000-4000-8000-000000000103', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000006', 1, 'personality', 'Which Season Matches You?',
   '{"questions": [{}], "outcomes": [{"id": "o-winter", "title": "Winter"}]}', null,
   '[{"outcome_id": "o-winter", "points": 1}]'),
  ('b0000000-0000-4000-8000-000000000104', '22222222-2222-4222-8222-222222222222',
   'a0000000-0000-4000-8000-000000000008', 1, 'personality', 'Which Pet Suits You?',
   '{"questions": [{}], "outcomes": [{"id": "o-dog", "title": "Dog"}]}', null,
   '[{"outcome_id": "o-dog", "points": 1}]');

insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at, claim_token_hash)
values ('b0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 1,
        'trivia', 'Anonymous', '{"questions": [{}, {}]}', 1, now() + interval '1 day',
        encode(sha256(convert_to('token-five', 'UTF8')), 'hex'));

-- How many quizzes Alex made, worked out before switching roles.
create temp table expected as
  select count(*)::int as alex_quizzes
  from public.quizzes where creator_id = '11111111-1111-4111-8111-111111111111';
grant select on expected to authenticated;

-- ---------------------------------------------------------------------------
-- As Alex
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is((public.get_my_dashboard_summary() ->> 'results_saved')::int, 3,
  'counts only the caller''s saved results, never anonymous ones');
select is((public.get_my_dashboard_summary() ->> 'quizzes_made')::int,
  (select alex_quizzes from expected), 'counts the quizzes the caller made');
select is((public.get_my_dashboard_summary() ->> 'average_trivia_score')::numeric, 0.75,
  'averages the caller''s trivia scores only');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.get_my_dashboard_summary()) as k),
  array['average_trivia_score', 'quizzes_made', 'results_saved'],
  'returns only the three figures, no account fields'
);
reset role;

-- ---------------------------------------------------------------------------
-- As Sam: personality only, then one trivia result that scored 0
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);

select is((public.get_my_dashboard_summary() ->> 'results_saved')::int, 1,
  'another member sees only their own results');
select is(public.get_my_dashboard_summary() -> 'average_trivia_score', 'null'::jsonb,
  'no trivia results means a null average');
reset role;

insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score)
values ('b0000000-0000-4000-8000-000000000106', '22222222-2222-4222-8222-222222222222',
        'a0000000-0000-4000-8000-000000000004', 1, 'trivia', 'Food Around the World',
        '{"questions": [{}, {}]}', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((public.get_my_dashboard_summary() ->> 'average_trivia_score')::numeric, 0::numeric,
  'a zero average is zero, not null');
reset role;

-- ---------------------------------------------------------------------------
-- Logged-out visitors, and the function's own settings
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select public.get_my_dashboard_summary()', '42501', null,
  'anon cannot execute it');
reset role;

-- The error above would also come from the function's own logged-out check, so check
-- the grants directly too: only authenticated may execute it.
select ok(
  not has_function_privilege('anon', 'public.get_my_dashboard_summary()', 'execute'),
  'anon has no execute grant'
);
select ok(
  has_function_privilege('authenticated', 'public.get_my_dashboard_summary()', 'execute'),
  'authenticated has the execute grant'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.get_my_dashboard_summary()'::regprocedure),
  'get_my_dashboard_summary is security definer'
);
select ok(
  (select 'search_path=""' = any (proconfig) from pg_proc
   where oid = 'public.get_my_dashboard_summary()'::regprocedure),
  'get_my_dashboard_summary has an empty search_path'
);

select * from finish();
rollback;
