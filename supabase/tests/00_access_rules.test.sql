-- Access rules for quizzes and results (feature 0 criterion 20).
-- Runs against the seeded database inside a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- Seeded members and quizzes.
-- Alex: 11111111-1111-4111-8111-111111111111, owns quiz ...0001
-- Sam:  22222222-2222-4222-8222-222222222222, owns quiz ...0004

-- Results to test against, inserted as the table owner.
insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score)
values
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000004', 1, 'trivia', 'Food Around the World', '{}', 0.5),
  ('b0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'World Capitals', '{}', 1);

insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at, claim_token_hash)
values
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia',
   'World Capitals', '{}', 0, now() + interval '1 day', 'hash');

-- ---------------------------------------------------------------------------
-- RLS is on everywhere
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'RLS is enabled on every table in public'
);

-- ---------------------------------------------------------------------------
-- Public quiz content
-- ---------------------------------------------------------------------------
set local role anon;
select ok((select count(*) from public.quizzes_public) > 0, 'anon can read quizzes_public');
select ok((select count(*) from public.questions) > 0, 'anon can read questions');
select ok((select count(*) from public.options) > 0, 'anon can read options');
select ok((select count(*) from public.outcomes) > 0, 'anon can read outcomes');
select throws_ok('select creator_id from public.quizzes', '42501', null, 'anon cannot read quizzes.creator_id');
select throws_ok('select * from public.option_keys', '42501', null, 'anon cannot read option_keys');
select throws_ok('select id from public.results', '42501', null, 'anon cannot select from results');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select ok((select count(*) from public.quizzes_public) > 0, 'authenticated can read quizzes_public');
select ok((select count(*) from public.questions) > 0, 'authenticated can read questions');
select ok((select count(*) from public.options) > 0, 'authenticated can read options');
select ok((select count(*) from public.outcomes) > 0, 'authenticated can read outcomes');
select throws_ok('select creator_id from public.quizzes', '42501', null, 'authenticated cannot read quizzes.creator_id');
select throws_ok('select * from public.option_keys', '42501', null, 'authenticated cannot read option_keys');

-- ---------------------------------------------------------------------------
-- Results: members see only their own rows, never the token hash, and cannot write
-- ---------------------------------------------------------------------------
select results_eq(
  'select id from public.results',
  $$values ('b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'a member sees only their own results'
);
select throws_ok('select claim_token_hash from public.results', '42501', null, 'a member cannot read claim_token_hash');
select throws_ok(
  $$insert into public.results (quiz_version, quiz_kind, quiz_title, snapshot, score, owner_id)
    values (1, 'trivia', 'x', '{}', 1, '11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'a member cannot insert results'
);
select throws_ok('update public.results set quiz_title = $$x$$', '42501', null, 'a member cannot update results');
select throws_ok('delete from public.results', '42501', null, 'a member cannot delete results');

-- ---------------------------------------------------------------------------
-- Creators delete only their own quizzes
-- ---------------------------------------------------------------------------
-- Alex tries to delete Sam's quiz, then their own.
delete from public.quizzes where id = 'a0000000-0000-4000-8000-000000000004';
delete from public.quizzes where id = 'a0000000-0000-4000-8000-000000000001';
reset role;

select ok(
  exists (select 1 from public.quizzes where id = 'a0000000-0000-4000-8000-000000000004'),
  'a creator cannot delete someone else''s quiz'
);
select ok(
  not exists (select 1 from public.quizzes where id = 'a0000000-0000-4000-8000-000000000001'),
  'a creator can delete their own quiz'
);

select is(
  (select quiz_id from public.results where id = 'b0000000-0000-4000-8000-000000000002'),
  null::uuid,
  'deleting a quiz sets results.quiz_id to null and keeps the result'
);

-- ---------------------------------------------------------------------------
-- service_role cannot delete results
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok('delete from public.results', '42501', null, 'service_role cannot delete results');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting an account removes that member's quizzes and results only
-- ---------------------------------------------------------------------------
delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*) from public.quizzes where creator_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'deleting a member removes their quizzes'
);
select is(
  (select count(*) from public.results where owner_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'deleting a member removes their results'
);
select is(
  (select quiz_id from public.results where id = 'b0000000-0000-4000-8000-000000000001'),
  null::uuid,
  'other members keep their results for the deleted member''s quizzes'
);

-- ---------------------------------------------------------------------------
-- Results check constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.results (owner_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at)
    values ('11111111-1111-4111-8111-111111111111', 1, 'trivia', 'x', '{}', 1, now())$$,
  '23514', null, 'an owned result cannot have an expiry'
);

select * from finish();
rollback;
