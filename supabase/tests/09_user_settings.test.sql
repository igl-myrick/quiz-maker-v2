-- user_settings access and constraints (feature 5, criteria 12 and 22).
-- Alex is 11111111-…, Sam is 22222222-…
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Sam already has a row, written as the owner would.
insert into public.user_settings (user_id, theme) values ('22222222-2222-4222-8222-222222222222', 'dark');

-- ---------------------------------------------------------------------------
-- Anonymous visitors get nothing
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.user_settings', '42501', null, 'anonymous visitors cannot read settings');
select throws_ok(
  $$insert into public.user_settings (user_id) values ('11111111-1111-4111-8111-111111111111')$$,
  '42501', null, 'anonymous visitors cannot write settings'
);
reset role;

-- ---------------------------------------------------------------------------
-- A member reads and writes only their own row
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is((select count(*) from public.user_settings), 0::bigint, 'a member cannot see other members'' settings');

select lives_ok(
  $$insert into public.user_settings (user_id) values ('11111111-1111-4111-8111-111111111111')$$,
  'a member can insert their own row'
);
select results_eq(
  'select theme::text, text_size, high_contrast::text, dyslexia_font from public.user_settings',
  $$values ('system', 'default', 'system', false)$$,
  'the new row has the defaults, and is the only one the member sees'
);

select lives_ok(
  $$update public.user_settings set theme = 'light', text_size = 'largest', high_contrast = 'on', dyslexia_font = true
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  'a member can update their own row'
);
select results_eq(
  'select theme::text, text_size, high_contrast::text, dyslexia_font from public.user_settings',
  $$values ('light', 'largest', 'on', true)$$,
  'the update is saved'
);

select throws_ok(
  $$insert into public.user_settings (user_id) values ('22222222-2222-4222-8222-222222222222')$$,
  '42501', null, 'a member cannot insert a row for someone else'
);
select is_empty(
  $$update public.user_settings set theme = 'light' where user_id = '22222222-2222-4222-8222-222222222222' returning 1$$,
  'a member cannot update someone else''s row'
);
select throws_ok(
  $$update public.user_settings set user_id = '22222222-2222-4222-8222-222222222222'
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', null, 'a member cannot move their row to someone else'
);
select throws_ok(
  'delete from public.user_settings', '42501', null, 'a member cannot delete settings'
);
reset role;

select is(
  (select theme::text from public.user_settings where user_id = '22222222-2222-4222-8222-222222222222'),
  'dark',
  'the other member''s row is unchanged'
);

-- ---------------------------------------------------------------------------
-- Only the allowed values
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.user_settings set text_size = 'huge' where user_id = '22222222-2222-4222-8222-222222222222'$$,
  '23514', null, 'text_size rejects other values'
);
select throws_ok(
  $$update public.user_settings set theme = 'blue' where user_id = '22222222-2222-4222-8222-222222222222'$$,
  '22P02', null, 'theme rejects other values'
);

select * from finish();
rollback;
