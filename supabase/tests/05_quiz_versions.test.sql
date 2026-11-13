-- Retired versions (feature 1, criterion 19).
-- Seeded: Alex owns …0001 (trivia), …0002 (trivia), …0006 (personality);
-- Sam owns …0004, …0005, …0007, …0008 and …0010.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- An edit retires the version it replaces, with its answer key
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$select public.save_quiz(
      jsonb_set(
        public.get_quiz_for_edit('a0000000-0000-4000-8000-000000000001') -> 'quiz',
        '{questions,0,prompt}', '"A new first question"'
      ) || '{"expected_version": 1}'
    )$$,
  'the creator edits their quiz'
);
reset role;

select is(
  (select snapshot -> 'quiz' ->> 'version' from public.quiz_versions
   where quiz_id = 'a0000000-0000-4000-8000-000000000001' and version = 1),
  '1',
  'the edit retires version 1'
);
select is(
  (select snapshot -> 'questions' -> 0 ->> 'prompt' from public.quiz_versions
   where quiz_id = 'a0000000-0000-4000-8000-000000000001' and version = 1),
  'What is the capital of Australia?',
  'the retired copy holds the old questions'
);
select ok(
  (select snapshot -> 'questions' -> 0 -> 'options' -> 1 ? 'is_correct' from public.quiz_versions
   where quiz_id = 'a0000000-0000-4000-8000-000000000001' and version = 1),
  'the retired copy holds the answer key'
);
select is(
  (select snapshot -> 'questions' -> 0 -> 'options' -> 1 ->> 'is_correct' from public.quiz_versions
   where quiz_id = 'a0000000-0000-4000-8000-000000000001' and version = 1),
  'true',
  'and the key is the one from the old version (Canberra was correct)'
);

-- ---------------------------------------------------------------------------
-- A delete retires the last version, also through an account deletion
-- ---------------------------------------------------------------------------
delete from public.quizzes where id = 'a0000000-0000-4000-8000-000000000006';
select ok(
  exists (select 1 from public.quiz_versions where quiz_id = 'a0000000-0000-4000-8000-000000000006' and version = 1),
  'deleting a quiz retires its last version'
);
select ok(
  (select snapshot -> 'questions' -> 0 -> 'options' -> 0 ?& array['outcome_id', 'points'] from public.quiz_versions
   where quiz_id = 'a0000000-0000-4000-8000-000000000006'),
  'a retired personality quiz keeps each answer''s outcome and points'
);
select is(
  (select jsonb_array_length(snapshot -> 'outcomes') from public.quiz_versions
   where quiz_id = 'a0000000-0000-4000-8000-000000000006'),
  4,
  'and its outcomes'
);

delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::int from public.quiz_versions where quiz_id in (
    'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000008',
    'a0000000-0000-4000-8000-000000000010')),
  5,
  'deleting an account retires the last version of each of its quizzes'
);

-- ---------------------------------------------------------------------------
-- Only the grading function (service_role) can read retired versions
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.quiz_versions', '42501', null, 'anonymous visitors cannot read quiz_versions');
reset role;

set local role authenticated;
select throws_ok('select * from public.quiz_versions', '42501', null, 'members cannot read quiz_versions');
select throws_ok(
  $$select public.retire_quiz_version('a0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'members cannot retire versions themselves'
);
select throws_ok(
  $$select public.quiz_snapshot('a0000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'members cannot read a quiz with its answer key'
);
reset role;

set local role service_role;
select ok((select count(*) from public.quiz_versions) > 0, 'the grading function''s role can read quiz_versions');
select is(
  public.quiz_snapshot('a0000000-0000-4000-8000-000000000001') -> 'quiz' ->> 'title', 'World Capitals',
  'the grading function''s role can read the live quiz with its key'
);
select is(public.quiz_snapshot('a0000000-0000-4000-8000-0000000000ff'), null,
  'a quiz that doesn''t exist has no snapshot');
reset role;

select * from finish();
rollback;
