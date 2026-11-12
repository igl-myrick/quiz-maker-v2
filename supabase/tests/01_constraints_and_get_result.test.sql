-- Title normalization, the anonymous-result constraint, and get_result (feature 0 criterion 20).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- normalized_title: one title per creator, ignoring case and whitespace
-- ---------------------------------------------------------------------------
insert into public.quizzes (creator_id, kind, title)
values ('11111111-1111-4111-8111-111111111111', 'trivia', 'Capitals Quiz');

select throws_ok(
  $$insert into public.quizzes (creator_id, kind, title)
    values ('11111111-1111-4111-8111-111111111111', 'trivia', 'capitals  quiz')$$,
  '23505', null, 'extra spaces and capitals count as the same title'
);
select throws_ok(
  $$insert into public.quizzes (creator_id, kind, title)
    values ('11111111-1111-4111-8111-111111111111', 'trivia', E'Capitals\tQuiz')$$,
  '23505', null, 'a tab counts as a space in titles'
);
select lives_ok(
  $$insert into public.quizzes (creator_id, kind, title)
    values ('22222222-2222-4222-8222-222222222222', 'trivia', 'Capitals Quiz')$$,
  'a different creator may use the same title'
);

-- ---------------------------------------------------------------------------
-- Anonymous results always carry a token hash
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.results (quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at)
    values (1, 'trivia', 'x', '{}', 1, now() + interval '1 day')$$,
  '23514', null, 'an anonymous result needs a token hash'
);

-- ---------------------------------------------------------------------------
-- get_result
-- ---------------------------------------------------------------------------

-- An owned trivia result for an unchanged quiz.
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score)
values ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'World Capitals',
        '{"snapshot_version": 1, "questions": []}', 0.75);

-- An expired anonymous result (cleanup has not run yet).
insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at, claim_token_hash)
values ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia',
        'World Capitals', '{}', 1, now() - interval '1 minute', 'hash');

-- A personality result for a quiz that has since been edited (version 2).
update public.quizzes set version = 2 where id = 'a0000000-0000-4000-8000-000000000006';
insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, outcome_ranking, expires_at, claim_token_hash)
values (
  'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', 1, 'personality',
  'Which Season Matches You?',
  '{
    "snapshot_version": 1,
    "outcomes": [
      {"id": "d0000000-0000-4000-8000-000000000001", "title": "Spring", "description": "Fresh."},
      {"id": "d0000000-0000-4000-8000-000000000002", "title": "Winter", "description": "Calm."}
    ],
    "questions": [
      {"id": "e1", "position": 1, "type": "single_choice", "prompt": "Pick one",
       "options": [
         {"id": "f1", "label": "Garden", "outcome_id": "d0000000-0000-4000-8000-000000000001", "points": 1},
         {"id": "f2", "label": "Fire", "outcome_id": "d0000000-0000-4000-8000-000000000002", "points": 2}
       ],
       "selected_option_ids": ["f2"]}
    ]
  }',
  '[{"outcome_id": "d0000000-0000-4000-8000-000000000002", "points": 2},
    {"outcome_id": "d0000000-0000-4000-8000-000000000001", "points": 0}]',
  now() + interval '1 day', 'hash'
);

set local role anon;

select is(
  public.get_result('c0000000-0000-4000-8000-000000000001') ->> 'status', 'ok',
  'get_result returns ok for an existing result'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000001') -> 'quiz_updated', 'false'::jsonb,
  'quiz_updated is false when the quiz is unchanged'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000001') -> 'claimable', 'false'::jsonb,
  'an owned result is not claimable'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000002'), '{"status": "expired"}'::jsonb,
  'get_result returns only expired past expires_at, before cleanup runs'
);
select is(
  public.get_result('c0000000-0000-4000-8000-0000000000ff'), '{"status": "not_found"}'::jsonb,
  'get_result returns only not_found for an unknown ID'
);
select ok(
  not (public.get_result('c0000000-0000-4000-8000-000000000001')::text ~ '(owner_id|claim_token_hash|outcome_ranking)'),
  'get_result never includes owner_id, claim_token_hash or outcome_ranking'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000003') -> 'quiz_updated', 'true'::jsonb,
  'quiz_updated is true when the quiz has a newer version'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000003') -> 'claimable', 'true'::jsonb,
  'an unexpired anonymous result is claimable'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000003') -> 'result' -> 'winning_outcome',
  '{"id": "d0000000-0000-4000-8000-000000000002", "title": "Winter", "description": "Calm."}'::jsonb,
  'personality results return the winning outcome from the stored ranking'
);
select ok(
  not (public.get_result('c0000000-0000-4000-8000-000000000003') -> 'result' -> 'snapshot') ? 'outcomes',
  'personality snapshots have their outcomes removed'
);
select ok(
  not (public.get_result('c0000000-0000-4000-8000-000000000003')::text ~ '(outcome_id|"points")'),
  'personality options have no outcome_id or points'
);
select is(
  public.get_result('c0000000-0000-4000-8000-000000000001') -> 'result' -> 'winning_outcome', 'null'::jsonb,
  'trivia results have no winning outcome'
);

reset role;
select * from finish();
rollback;
