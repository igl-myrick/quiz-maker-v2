-- claim_result (feature 3, criteria 19 and 24; ARCHITECTURE_SPEC.md 12).
-- Alex is 11111111-…, Sam is 22222222-…
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Anonymous results, as submit-quiz stores them: the token's hash, and a 1-day expiry.
insert into public.results (id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score, expires_at, claim_token_hash)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'Open', '{}', 1,
   now() + interval '1 day', encode(sha256(convert_to('token-one', 'UTF8')), 'hex')),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 1, 'trivia', 'Expired', '{}', 1,
   now() - interval '1 minute', encode(sha256(convert_to('token-two', 'UTF8')), 'hex'));

-- ---------------------------------------------------------------------------
-- Who can call it
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select public.claim_result('d0000000-0000-4000-8000-000000000001', 'token-one')$$,
  '42501', null, 'anonymous visitors cannot claim'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.claim_result('d0000000-0000-4000-8000-000000000001', 'token-one')$$,
  '42501', 'claim_result requires a logged-in member', 'it raises without a user ID'
);
reset role;

-- ---------------------------------------------------------------------------
-- Failing claims change nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select is(
  public.claim_result('d0000000-0000-4000-8000-000000000001', 'wrong-token'), false,
  'a wrong token fails'
);
select is(
  public.claim_result('d0000000-0000-4000-8000-000000000002', 'token-two'), false,
  'an expired result cannot be claimed'
);
select is(
  public.claim_result('d0000000-0000-4000-8000-000000000099', 'token-one'), false,
  'a result that does not exist cannot be claimed'
);
reset role;

select is(
  (select owner_id from public.results where id = 'd0000000-0000-4000-8000-000000000001'), null,
  'a failed claim leaves the result unowned'
);

-- ---------------------------------------------------------------------------
-- A good claim succeeds once
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select is(
  public.claim_result('d0000000-0000-4000-8000-000000000001', 'token-one'), true,
  'the right token claims the result'
);
select is(
  public.claim_result('d0000000-0000-4000-8000-000000000001', 'token-one'), false,
  'a second claim fails'
);
reset role;

select is(
  (select owner_id from public.results where id = 'd0000000-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the claimed result belongs to the member'
);
select ok(
  (select expires_at is null and claim_token_hash is null from public.results
   where id = 'd0000000-0000-4000-8000-000000000001'),
  'the claimed result has no expiry and no token hash'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is(
  public.claim_result('d0000000-0000-4000-8000-000000000001', 'token-one'), false,
  'another member cannot claim a result that is already owned'
);
reset role;

select is(
  (select owner_id from public.results where id = 'd0000000-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the owner is unchanged'
);

select * from finish();
rollback;
