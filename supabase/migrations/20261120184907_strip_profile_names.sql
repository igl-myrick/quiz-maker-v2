-- Remove names and GitHub usernames from login profiles (change 9, criteria 20 to 22).
-- Google and GitHub send the member's name along with their picture, and Supabase Auth
-- saves the profile again on every login, so a trigger removes these keys whenever the
-- profile is written. The email, avatar URL and the provider's IDs are kept.

create function public.strip_profile_names()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  name_keys constant text[] := array[
    'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
    'user_name', 'preferred_username'
  ];
begin
  if tg_table_name = 'users' then
    new.raw_user_meta_data := new.raw_user_meta_data - name_keys;
  else
    new.identity_data := new.identity_data - name_keys;
  end if;
  return new;
end;
$$;

-- Triggers run it without an execute grant, so no client role needs one.
revoke execute on function public.strip_profile_names() from public, anon, authenticated, service_role;

create trigger users_strip_profile_names
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.strip_profile_names();

create trigger identities_strip_profile_names
  before insert or update of identity_data on auth.identities
  for each row execute function public.strip_profile_names();

-- Profiles saved before this migration.
update auth.users
set raw_user_meta_data = raw_user_meta_data - array[
  'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
  'user_name', 'preferred_username'
]
where raw_user_meta_data ?| array[
  'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
  'user_name', 'preferred_username'
];

update auth.identities
set identity_data = identity_data - array[
  'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
  'user_name', 'preferred_username'
]
where identity_data ?| array[
  'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
  'user_name', 'preferred_username'
];
