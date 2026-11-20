-- Names and GitHub usernames are removed whenever Supabase saves a login profile
-- (change 9, criteria 20 to 23).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- A new member, saved the way Supabase saves a Google or GitHub login.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token
)
values (
  '00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'kim@example.test', '', now(),
  '{"provider": "github", "providers": ["github"]}',
  '{"sub": "42", "iss": "https://api.github.com", "email": "kim@example.test",
    "email_verified": true, "phone_verified": false, "provider_id": "42",
    "avatar_url": "https://avatars.example.test/42", "picture": "https://avatars.example.test/42",
    "name": "Kim Lee", "full_name": "Kim Lee", "given_name": "Kim", "family_name": "Lee",
    "middle_name": "J", "nickname": "kimmy", "user_name": "kimlee", "preferred_username": "kimlee"}',
  now(), now(), '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
values (
  'a3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', '42', 'github',
  '{"sub": "42", "iss": "https://api.github.com", "email": "kim@example.test",
    "email_verified": true, "phone_verified": false, "provider_id": "42",
    "avatar_url": "https://avatars.example.test/42",
    "name": "Kim Lee", "full_name": "Kim Lee", "user_name": "kimlee", "preferred_username": "kimlee"}',
  now(), now(), now()
);

select is(
  (select raw_user_meta_data from auth.users where id = '33333333-3333-4333-8333-333333333333'),
  '{"sub": "42", "iss": "https://api.github.com", "email": "kim@example.test",
    "email_verified": true, "phone_verified": false, "provider_id": "42",
    "avatar_url": "https://avatars.example.test/42", "picture": "https://avatars.example.test/42"}'::jsonb,
  'a new user is saved without names or a username, keeping everything else'
);
select is(
  (select identity_data from auth.identities where id = 'a3333333-3333-4333-8333-333333333333'),
  '{"sub": "42", "iss": "https://api.github.com", "email": "kim@example.test",
    "email_verified": true, "phone_verified": false, "provider_id": "42",
    "avatar_url": "https://avatars.example.test/42"}'::jsonb,
  'a new identity is saved without names or a username, keeping everything else'
);

-- A later login: Supabase writes the provider's profile again.
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"name": "Kim Lee", "user_name": "kimlee"}'
where id = '33333333-3333-4333-8333-333333333333';
update auth.identities
set identity_data = identity_data || '{"full_name": "Kim Lee", "preferred_username": "kimlee"}'
where id = 'a3333333-3333-4333-8333-333333333333';

select ok(
  not (select raw_user_meta_data ?| array['name', 'user_name']
       from auth.users where id = '33333333-3333-4333-8333-333333333333'),
  'names added back by a later login are removed from the user'
);
select ok(
  not (select identity_data ?| array['full_name', 'preferred_username']
       from auth.identities where id = 'a3333333-3333-4333-8333-333333333333'),
  'names added back by a later login are removed from the identity'
);
select is(
  (select email from auth.users where id = '33333333-3333-4333-8333-333333333333'),
  'kim@example.test',
  'the email stays'
);

-- No row anywhere holds a name, including rows saved before the migration.
select is(
  (select count(*) from auth.users where raw_user_meta_data ?| array[
    'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
    'user_name', 'preferred_username']),
  0::bigint,
  'no user holds a name or username'
);
select is(
  (select count(*) from auth.identities where identity_data ?| array[
    'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
    'user_name', 'preferred_username']),
  0::bigint,
  'no identity holds a name or username'
);

-- Clients can't call the trigger function.
select ok(
  not has_function_privilege('authenticated', 'public.strip_profile_names()', 'execute'),
  'members cannot run the trigger function directly'
);

select * from finish();
rollback;
