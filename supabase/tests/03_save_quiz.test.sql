-- save_quiz and get_quiz_for_edit (feature 2, criterion 27).
-- Seeded members: Alex 11111111-…, who owns "World Capitals" (…0001, trivia) and
-- "Which Season Matches You?" (…0006, personality); Sam 22222222-…, who owns …0004.
begin;
create extension if not exists pgtap with schema extensions;

select plan(55);

-- ---------------------------------------------------------------------------
-- Helpers, in a schema that is rolled back with the test
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

-- A valid trivia quiz with one question of each type.
create function tests.trivia() returns jsonb language sql as $$
  select '{
    "kind": "trivia", "title": "Test Trivia", "description": "A test quiz.",
    "suggested_time_seconds": null, "outcomes": [],
    "questions": [
      {"type": "single_choice", "prompt": "Pick A", "options": [
        {"label": "A", "is_correct": true}, {"label": "B", "is_correct": false}]},
      {"type": "true_false", "prompt": "Is it true?", "options": [
        {"label": "True", "is_correct": true}, {"label": "False", "is_correct": false}]},
      {"type": "multi_select", "prompt": "Pick A and B", "options": [
        {"label": "A", "is_correct": true}, {"label": "B", "is_correct": true},
        {"label": "C", "is_correct": false}]}
    ]
  }'::jsonb
$$;

-- A valid personality quiz with 2 outcomes, both reachable.
create function tests.personality() returns jsonb language sql as $$
  select '{
    "kind": "personality", "title": "Test Personality", "description": "",
    "suggested_time_seconds": 300,
    "outcomes": [
      {"key": "k1", "title": "Cat", "description": "Independent."},
      {"key": "k2", "title": "Dog", "description": ""}
    ],
    "questions": [
      {"type": "single_choice", "prompt": "Q1", "options": [
        {"label": "Nap", "outcome_key": "k1", "points": 1}, {"label": "Run", "outcome_key": "k2", "points": 2}]},
      {"type": "single_choice", "prompt": "Q2", "options": [
        {"label": "Quiet", "outcome_key": "k1", "points": 3}, {"label": "Loud", "outcome_key": "k2", "points": 1}]},
      {"type": "single_choice", "prompt": "Q3", "options": [
        {"label": "Inside", "outcome_key": "k1", "points": 1}, {"label": "Outside", "outcome_key": "k2", "points": 1}]}
    ]
  }'::jsonb
$$;

-- Runs save_quiz and returns "message: detail" for a failure, or 'ok'.
create function tests.save_error(p_quiz jsonb) returns text language plpgsql as $$
declare
  v_message text;
  v_detail text;
begin
  perform public.save_quiz(p_quiz);
  return 'ok';
exception when others then
  get stacked diagnostics v_message = message_text, v_detail = pg_exception_detail;
  return v_message || coalesce(': ' || nullif(v_detail, ''), '');
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Act as Alex from here on unless switched.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Valid quizzes are saved
-- ---------------------------------------------------------------------------
select is(tests.save_error(tests.trivia()), 'ok', 'a valid trivia quiz is saved');
select is(tests.save_error(tests.personality()), 'ok', 'a valid personality quiz is saved');
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{title}', '"  Spaced   Title  "')), 'ok',
  'a title with extra spaces is saved'
);

reset role;
select is(
  (select title from public.quizzes where normalized_title = 'spaced title'), 'Spaced   Title',
  'text is trimmed at both ends before it is stored'
);
select is(
  (select count(*)::int from public.option_keys k
     join public.options o on o.id = k.option_id
     join public.questions q on q.id = o.question_id
     join public.quizzes z on z.id = q.quiz_id
   where z.title = 'Test Personality' and k.outcome_id is not null and k.points between 1 and 3),
  6,
  'personality answers are stored with their outcome and points'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Each rule in CLAUDE.md section 1 is rejected
-- ---------------------------------------------------------------------------
select is(tests.save_error(tests.trivia() #- '{questions,2}'),
  'invalid_quiz: A quiz needs 3 to 50 questions.', 'fewer than 3 questions');
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{questions}',
    (select jsonb_agg(tests.trivia() -> 'questions' -> 0) from generate_series(1, 51)))),
  'invalid_quiz: A quiz needs 3 to 50 questions.', 'more than 50 questions');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,options,1,is_correct}', 'true')),
  'invalid_quiz: Question 1: mark exactly 1 correct answer.', 'single-choice with 2 correct');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,options,0,is_correct}', 'false')),
  'invalid_quiz: Question 1: mark exactly 1 correct answer.', 'single-choice with none correct');
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{questions,0,options}', '[{"label": "A", "is_correct": true}]')),
  'invalid_quiz: Question 1 needs 2 to 8 answers.', 'fewer than 2 answers');
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{questions,2,options}',
    (select jsonb_agg(jsonb_build_object('label', 'Answer ' || n, 'is_correct', n = 1))
     from generate_series(1, 9) as n))),
  'invalid_quiz: Question 3 needs 2 to 8 answers.', 'more than 8 answers');
select is(
  tests.save_error(jsonb_set(jsonb_set(tests.trivia(),
    '{questions,1,options,0,label}', '"Yes"'), '{questions,1,options,1,label}', '"No"')),
  'invalid_quiz: Question 2: true/false answers are True and False, with 1 correct.',
  'true/false answers not labelled True and False');
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{questions,1,options,2}', '{"label": "Maybe", "is_correct": false}')),
  'invalid_quiz: Question 2: true/false answers are True and False, with 1 correct.',
  'true/false with 3 answers');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,1,options,1,is_correct}', 'true')),
  'invalid_quiz: Question 2: true/false answers are True and False, with 1 correct.',
  'true/false with both correct');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,2,options,2,is_correct}', 'true')),
  'invalid_quiz: Question 3: mark at least 1 correct and 1 incorrect answer.', 'multi-select all correct');
select is(
  tests.save_error(jsonb_set(jsonb_set(tests.trivia(),
    '{questions,2,options,0,is_correct}', 'false'), '{questions,2,options,1,is_correct}', 'false')),
  'invalid_quiz: Question 3: mark at least 1 correct and 1 incorrect answer.', 'multi-select none correct');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,options,0,points}', '1')),
  'invalid_quiz: Question 1: mark each answer correct or not.', 'a trivia answer with points');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,type}', '"essay"')),
  'invalid_quiz: Question 1: choose a question type.', 'an unknown question type');
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{outcomes}', '[{"key": "k1", "title": "Cat"}]')),
  'invalid_quiz: Trivia quizzes have no outcomes.', 'a trivia quiz with outcomes');

-- Personality rules
select is(tests.save_error(jsonb_set(tests.personality(), '{questions,0,type}', '"multi_select"')),
  'invalid_quiz: Question 1: personality questions are single-choice.', 'a personality multi-select');
select is(tests.save_error(tests.personality() #- '{outcomes,1}'),
  'invalid_quiz: A personality quiz needs 2 to 30 outcomes.', 'only 1 outcome');
select is(
  tests.save_error(jsonb_set(tests.personality(), '{outcomes}',
    (select jsonb_agg(jsonb_build_object('key', 'k' || n, 'title', 'Outcome ' || n))
     from generate_series(1, 31) as n))),
  'invalid_quiz: A personality quiz needs 2 to 30 outcomes.', 'more than 30 outcomes');
select is(
  tests.save_error(jsonb_set(tests.personality(), '{outcomes,2}', '{"key": "k3", "title": "Fish"}')),
  'invalid_quiz: Every outcome needs at least 1 answer pointing to it.', 'an unreachable outcome');
select is(
  tests.save_error(jsonb_set(tests.personality(), '{questions,0,options,0,outcome_key}', '"nope"')),
  'invalid_quiz: Question 1: every answer needs one of this quiz''s outcomes.',
  'an answer pointing to an outcome of another quiz');
select is(tests.save_error(jsonb_set(tests.personality(), '{questions,0,options,0,points}', '0')),
  'invalid_quiz: Question 1: every answer is worth 1, 2 or 3 points.', 'points 0');
select is(tests.save_error(jsonb_set(tests.personality(), '{questions,0,options,0,points}', '4')),
  'invalid_quiz: Question 1: every answer is worth 1, 2 or 3 points.', 'points 4');
select is(
  tests.save_error(jsonb_set(tests.personality(), '{outcomes,1,key}', '"k1"')),
  'invalid_quiz: Outcome 2 needs its own key.', 'two outcomes with the same key');

-- ---------------------------------------------------------------------------
-- Text and time limits
-- ---------------------------------------------------------------------------
select is(tests.save_error(jsonb_set(tests.trivia(), '{title}', '"  ab  "')),
  'invalid_quiz: The title must be 3 to 75 characters.', 'a title under 3 characters after trimming');
select is(tests.save_error(jsonb_set(tests.trivia(), '{title}', to_jsonb(repeat('x', 76)))),
  'invalid_quiz: The title must be 3 to 75 characters.', 'a title over 75 characters');
select is(tests.save_error(jsonb_set(tests.trivia(), '{description}', to_jsonb(repeat('x', 251)))),
  'invalid_quiz: The description can be up to 250 characters.', 'a description over 250 characters');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,prompt}', to_jsonb(E' \t\n '::text))),
  'invalid_quiz: Question 1: the question must be 1 to 300 characters.', 'a blank question');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,prompt}', to_jsonb(repeat('x', 301)))),
  'invalid_quiz: Question 1: the question must be 1 to 300 characters.', 'a question over 300 characters');
select is(tests.save_error(jsonb_set(tests.trivia(), '{questions,0,options,0,label}', to_jsonb(repeat('x', 151)))),
  'invalid_quiz: Question 1: every answer needs 1 to 150 characters.', 'an answer over 150 characters');
select is(tests.save_error(jsonb_set(tests.personality(), '{outcomes,0,title}', to_jsonb(repeat('x', 81)))),
  'invalid_quiz: Outcome 1: the name must be 1 to 80 characters.', 'an outcome name over 80 characters');
select is(tests.save_error(jsonb_set(tests.personality(), '{outcomes,0,description}', to_jsonb(repeat('x', 501)))),
  'invalid_quiz: Outcome 1: the description can be up to 500 characters.',
  'an outcome description over 500 characters');
select is(tests.save_error(jsonb_set(tests.trivia(), '{suggested_time_seconds}', '90')),
  'invalid_quiz: The suggested time must be 1 to 180 whole minutes.', 'a suggested time that is not whole minutes');
select is(tests.save_error(jsonb_set(tests.trivia(), '{suggested_time_seconds}', '10860')),
  'invalid_quiz: The suggested time must be 1 to 180 whole minutes.', 'a suggested time over 180 minutes');

-- ---------------------------------------------------------------------------
-- Titles, versions, ownership and callers
-- ---------------------------------------------------------------------------
select is(tests.save_error(jsonb_set(tests.trivia(), '{title}', '"world   CAPITALS "')),
  'duplicate_title: a0000000-0000-4000-8000-000000000001',
  'a duplicate normalized title names the existing quiz');

select is(
  tests.save_error(tests.trivia()
    || '{"id": "a0000000-0000-4000-8000-000000000001", "expected_version": 2, "title": "World Capitals"}'),
  'stale_version', 'an out-of-date expected_version');
select is(
  tests.save_error(tests.personality()
    || '{"id": "a0000000-0000-4000-8000-000000000001", "expected_version": 1}'),
  'kind_changed', 'changing a quiz''s kind');
select is(
  tests.save_error(tests.trivia()
    || '{"id": "a0000000-0000-4000-8000-000000000004", "expected_version": 1}'),
  'forbidden', 'editing someone else''s quiz');
select is(
  tests.save_error(tests.trivia()
    || '{"id": "a0000000-0000-4000-8000-0000000000ff", "expected_version": 1}'),
  'not_found', 'editing a quiz that doesn''t exist');

reset role;
set local role anon;
select throws_ok($$select public.save_quiz('{}')$$, '42501', null, 'anonymous visitors cannot call save_quiz');
reset role;

-- ---------------------------------------------------------------------------
-- An edit bumps the version, replaces child rows and leaves results alone
-- ---------------------------------------------------------------------------
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score)
values ('c0000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222',
        'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'World Capitals',
        '{"snapshot_version": 1, "marker": "unchanged"}', 1);

set local role authenticated;
select is(
  tests.save_error(jsonb_set(tests.trivia(), '{questions,0,prompt}', '"An edited question"')
    || '{"id": "a0000000-0000-4000-8000-000000000001", "expected_version": 1, "title": "World Capitals"}'),
  'ok', 'the creator can edit their quiz');
reset role;

select is(
  (select version from public.quizzes where id = 'a0000000-0000-4000-8000-000000000001'), 2,
  'an edit bumps the version');
select is(
  (select array_agg(prompt order by position) from public.questions
   where quiz_id = 'a0000000-0000-4000-8000-000000000001'),
  array['An edited question', 'Is it true?', 'Pick A and B'],
  'an edit replaces the questions');
select is(
  (select quiz_version || ' ' || (snapshot ->> 'marker') from public.results
   where id = 'c0000000-0000-4000-8000-000000000009'),
  '1 unchanged',
  'existing results are left unchanged');

-- ---------------------------------------------------------------------------
-- get_quiz_for_edit
-- ---------------------------------------------------------------------------
set local role authenticated;
select is(
  public.get_quiz_for_edit('a0000000-0000-4000-8000-000000000001') -> 'quiz' -> 'questions' -> 0 -> 'options' -> 0,
  '{"label": "A", "is_correct": true}'::jsonb,
  'the creator gets the answer key');
select is(
  public.get_quiz_for_edit('a0000000-0000-4000-8000-000000000006') -> 'quiz' -> 'questions' -> 0 -> 'options' -> 0 ? 'outcome_key',
  true,
  'personality answers come back with their outcome key');
select is(
  tests.save_error(
    (public.get_quiz_for_edit('a0000000-0000-4000-8000-000000000006') -> 'quiz')
    || '{"expected_version": 1}'),
  'ok', 'what get_quiz_for_edit returns can be saved again unchanged');
select is(public.get_quiz_for_edit('a0000000-0000-4000-8000-0000000000ff'),
  '{"status": "not_found"}'::jsonb, 'an unknown quiz is not_found');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is(public.get_quiz_for_edit('a0000000-0000-4000-8000-000000000001'),
  '{"status": "forbidden"}'::jsonb, 'another member gets forbidden and no answer key');
reset role;

set local role anon;
select throws_ok($$select public.get_quiz_for_edit('a0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'anonymous visitors cannot call get_quiz_for_edit');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting through the RLS policy
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
delete from public.quizzes where id = 'a0000000-0000-4000-8000-000000000004';
delete from public.quizzes where id = 'a0000000-0000-4000-8000-000000000002';
reset role;

select ok(exists (select 1 from public.quizzes where id = 'a0000000-0000-4000-8000-000000000004'),
  'a creator cannot delete another member''s quiz');
select ok(not exists (select 1 from public.quizzes where id = 'a0000000-0000-4000-8000-000000000002'),
  'a creator can delete their own quiz');

select * from finish();
rollback;
