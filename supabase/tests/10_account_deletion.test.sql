-- Account deletion cascades (feature 5, criteria 21 and 22; ARCHITECTURE_SPEC.md 7.2).
-- delete-account calls auth.admin.deleteUser, which deletes the auth.users row; the
-- foreign keys do the rest. Sam (22222222-…) owns quizzes …04, …05, …07, …08 and …10.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.user_settings (user_id, theme) values
  ('11111111-1111-4111-8111-111111111111', 'light'),
  ('22222222-2222-4222-8222-222222222222', 'dark');

insert into public.results (id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score)
values
  -- Sam's own result, on Alex's quiz.
  ('e0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'World Capitals', '{}', 1),
  -- Alex's result, on Sam's quiz.
  ('e0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000004', 1, 'trivia', 'Sam''s quiz', '{}', 1);

delete from auth.users where id = '22222222-2222-4222-8222-222222222222';

select is(
  (select count(*) from public.user_settings where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint, 'the member''s settings are deleted'
);
select is(
  (select count(*) from public.quizzes where creator_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint, 'the member''s quizzes are deleted'
);
select is(
  (select count(*) from public.results where owner_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint, 'the member''s results are deleted'
);
select is(
  (select quiz_id from public.results where id = 'e0000000-0000-4000-8000-000000000002'),
  null, 'another member''s result on a deleted quiz keeps its row, with no quiz link'
);
select is(
  (select count(distinct quiz_id) from public.quiz_versions where quiz_id in (
    'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000008',
    'a0000000-0000-4000-8000-000000000010')),
  5::bigint, 'each deleted quiz leaves a retired copy for in-progress takes'
);
select is(
  (select theme::text from public.user_settings where user_id = '11111111-1111-4111-8111-111111111111'),
  'light', 'other members'' settings are untouched'
);
select is(
  (select count(*) from public.quizzes where creator_id = '11111111-1111-4111-8111-111111111111'),
  5::bigint, 'other members'' quizzes are untouched'
);

select * from finish();
rollback;
