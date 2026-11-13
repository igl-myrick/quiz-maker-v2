-- list_my_results and list_my_quizzes (feature 3, criteria 6, 11 and 24).
-- Alex is 11111111-…, Sam is 22222222-…. Alex's five seeded quizzes share one created_at.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- The ids of a list response's items, in order.
create function pg_temp.ids(p_page jsonb) returns text[] language sql as $$
  select coalesce(array_agg(i.value ->> 'id' order by i.ordinality), '{}')
  from jsonb_array_elements(p_page -> 'items') with ordinality as i (value, ordinality)
$$;

-- ---------------------------------------------------------------------------
-- Results: Alex has four, two of them created at the same moment.
-- Sam has one, and there is one anonymous result.
-- ---------------------------------------------------------------------------
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, outcome_ranking, created_at)
values
  -- trivia, current
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'World Capitals',
   '{"questions": [{}, {}, {}, {}]}', 0.875, null, '2026-11-10 12:00'),
  -- trivia, the quiz has been edited since (its version is raised below)
  ('b0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000002', 1, 'trivia', 'The Solar System',
   '{"questions": [{}, {}, {}]}', 1, null, '2026-11-11 12:00'),
  -- trivia, the quiz has been deleted
  ('b0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   null, 1, 'trivia', 'Gone Quiz',
   '{"questions": [{}, {}, {}]}', 0, null, '2026-11-11 12:00'),
  -- personality: the stored ranking puts Winter first
  ('b0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000006', 1, 'personality', 'Which Season Matches You?',
   '{"questions": [{}, {}, {}], "outcomes": [{"id": "o-summer", "title": "Summer"}, {"id": "o-winter", "title": "Winter"}]}',
   null, '[{"outcome_id": "o-winter", "points": 5}, {"outcome_id": "o-summer", "points": 5}]', '2026-11-12 12:00'),
  -- Sam's
  ('b0000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222',
   'a0000000-0000-4000-8000-000000000004', 1, 'trivia', 'Sam''s result',
   '{"questions": [{}, {}, {}]}', 1, null, '2026-11-12 13:00');

insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at, claim_token_hash, created_at)
values ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'Anonymous',
        '{"questions": [{}, {}, {}]}', 1, now() + interval '1 day',
        encode(sha256(convert_to('token-six', 'UTF8')), 'hex'), '2026-11-09 12:00');

update public.quizzes set version = 2 where id = 'a0000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is(
  pg_temp.ids(public.list_my_results()),
  array[
    'b0000000-0000-4000-8000-000000000004',
    'b0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001'
  ],
  'list_my_results returns only the caller''s results, newest first, ties by id'
);
select is(public.list_my_results() -> 'next_cursor', 'null'::jsonb, 'one page holds them all');

-- Paging across the tie on 2026-11-11.
select is(
  pg_temp.ids(public.list_my_results(null, 2)),
  array['b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003'],
  'the first page of two'
);
select is(
  pg_temp.ids(public.list_my_results(public.list_my_results(null, 2) -> 'next_cursor', 2)),
  array['b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001'],
  'the second page continues across the tied created_at'
);
select is(
  public.list_my_results(public.list_my_results(null, 2) -> 'next_cursor', 2) -> 'next_cursor',
  'null'::jsonb,
  'the last page has no cursor'
);
select is(jsonb_array_length(public.list_my_results(null, 0) -> 'items'), 1, 'the limit is at least 1');

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.list_my_results() -> 'items' -> 0) as k),
  array['created_at', 'id', 'question_count', 'quiz_kind', 'quiz_status', 'quiz_title', 'score',
        'winning_outcome_title'],
  'each item has only the narrow fields: no snapshot, owner, token hash or expiry'
);

select is(
  (select i - 'created_at' from jsonb_array_elements(public.list_my_results() -> 'items') as i
   where i ->> 'id' = 'b0000000-0000-4000-8000-000000000001'),
  '{"id": "b0000000-0000-4000-8000-000000000001", "quiz_kind": "trivia", "quiz_title": "World Capitals",
    "score": 0.8750, "question_count": 4, "winning_outcome_title": null, "quiz_status": "current"}'::jsonb,
  'a trivia item has its score and question count, and a current quiz'
);
select is(
  (select i - 'created_at' from jsonb_array_elements(public.list_my_results() -> 'items') as i
   where i ->> 'id' = 'b0000000-0000-4000-8000-000000000004'),
  '{"id": "b0000000-0000-4000-8000-000000000004", "quiz_kind": "personality",
    "quiz_title": "Which Season Matches You?", "score": null, "question_count": null,
    "winning_outcome_title": "Winter", "quiz_status": "current"}'::jsonb,
  'a personality item has the stored winner''s title'
);
select is(
  (select i ->> 'quiz_status' from jsonb_array_elements(public.list_my_results() -> 'items') as i
   where i ->> 'id' = 'b0000000-0000-4000-8000-000000000002'),
  'updated',
  'a result for an edited quiz is marked updated'
);
select is(
  (select i ->> 'quiz_status' from jsonb_array_elements(public.list_my_results() -> 'items') as i
   where i ->> 'id' = 'b0000000-0000-4000-8000-000000000003'),
  'deleted',
  'a result whose quiz was deleted is marked deleted'
);

-- A just-claimed result joins the list.
select is(
  public.claim_result('b0000000-0000-4000-8000-000000000006', 'token-six'), true,
  'Alex claims the anonymous result'
);
select ok(
  'b0000000-0000-4000-8000-000000000006' = any (pg_temp.ids(public.list_my_results())),
  'a just-claimed result appears in list_my_results'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is(
  pg_temp.ids(public.list_my_results()),
  array['b0000000-0000-4000-8000-000000000005'],
  'another member sees only their own result'
);
reset role;

set local role anon;
select throws_ok('select public.list_my_results()', '42501', null, 'anonymous visitors cannot list results');
reset role;

select is(
  (select proconfig from pg_proc where oid = 'public.list_my_results(jsonb, int)'::regprocedure),
  array['search_path=""'],
  'list_my_results has an empty search_path'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.list_my_results(jsonb, int)'::regprocedure),
  'list_my_results runs with the caller''s rights'
);

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is(
  pg_temp.ids(public.list_my_quizzes()),
  array[
    'a0000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001'
  ],
  'list_my_quizzes returns only the caller''s quizzes, newest first, ties by id'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.list_my_quizzes() -> 'items' -> 0) as k),
  array['created_at', 'description', 'id', 'kind', 'question_count', 'suggested_time_seconds', 'title'],
  'each item has the search item''s fields and never creator_id'
);
select is(
  (public.list_my_quizzes() -> 'items' -> 4 ->> 'question_count')::int,
  (select count(*)::int from public.questions where quiz_id = 'a0000000-0000-4000-8000-000000000001'),
  'question_count counts the quiz''s questions'
);
select is(
  pg_temp.ids(public.list_my_quizzes(null, 2))
    || pg_temp.ids(public.list_my_quizzes(public.list_my_quizzes(null, 2) -> 'next_cursor', 2))
    || pg_temp.ids(public.list_my_quizzes(
         public.list_my_quizzes(public.list_my_quizzes(null, 2) -> 'next_cursor', 2) -> 'next_cursor', 2)),
  pg_temp.ids(public.list_my_quizzes()),
  'pages of two cover every quiz once, in order, across a shared created_at'
);
select is(
  public.list_my_quizzes(
    public.list_my_quizzes(public.list_my_quizzes(null, 2) -> 'next_cursor', 2) -> 'next_cursor', 2
  ) -> 'next_cursor',
  'null'::jsonb,
  'the last page has no cursor'
);

select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  'select public.list_my_quizzes()', '42501', 'list_my_quizzes requires a logged-in member',
  'it raises without a user ID'
);
reset role;

set local role anon;
select throws_ok('select public.list_my_quizzes()', '42501', null, 'anonymous visitors cannot list quizzes');
reset role;

select is(
  (select proconfig from pg_proc where oid = 'public.list_my_quizzes(jsonb, int)'::regprocedure),
  array['search_path=""'],
  'list_my_quizzes has an empty search_path'
);

select * from finish();
rollback;
