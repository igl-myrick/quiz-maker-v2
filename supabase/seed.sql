-- Local development seed only. Never run against a hosted project.
--
-- Two test members (log in with a code from the local test inbox from feature 4 onward):
--   alex@example.test  11111111-1111-4111-8111-111111111111
--   sam@example.test   22222222-2222-4222-8222-222222222222
--
-- Ten public quizzes: the eight from the feature 0 spec, plus one "General Knowledge" quiz per
-- member to show that different creators may share a title. No results are seeded.

-- ---------------------------------------------------------------------------
-- Test members: complete auth.users and auth.identities rows, with no password.
-- Token columns are empty strings rather than null, which Supabase Auth expects.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token
)
values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'alex@example.test', '', now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'sam@example.test', '', now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', '', '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
values
  (
    gen_random_uuid(), '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111', 'email',
    '{"sub": "11111111-1111-4111-8111-111111111111", "email": "alex@example.test", "email_verified": true, "phone_verified": false}',
    now(), now(), now()
  ),
  (
    gen_random_uuid(), '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222', 'email',
    '{"sub": "22222222-2222-4222-8222-222222222222", "email": "sam@example.test", "email_verified": true, "phone_verified": false}',
    now(), now(), now()
  );

-- ---------------------------------------------------------------------------
-- Session-only helpers (pg_temp disappears when the seed finishes).
-- ---------------------------------------------------------------------------

-- A trivia question. p_correct lists the 1-based positions of the correct options.
create function pg_temp.trivia_question(
  p_quiz uuid, p_position int, p_type public.question_type, p_prompt text,
  p_labels text[], p_correct int[]
) returns void language plpgsql as $$
declare
  v_question uuid;
  v_option uuid;
begin
  insert into public.questions (quiz_id, position, type, prompt)
  values (p_quiz, p_position, p_type, p_prompt)
  returning id into v_question;

  for i in 1 .. array_length(p_labels, 1) loop
    insert into public.options (question_id, position, label)
    values (v_question, i, p_labels[i])
    returning id into v_option;

    insert into public.option_keys (option_id, is_correct)
    values (v_option, i = any (p_correct));
  end loop;
end;
$$;

-- A personality question (single choice only). p_outcomes gives each option's outcome
-- position, and p_points its points (1 to 3).
create function pg_temp.personality_question(
  p_quiz uuid, p_position int, p_prompt text,
  p_labels text[], p_outcomes int[], p_points int[]
) returns void language plpgsql as $$
declare
  v_question uuid;
  v_option uuid;
  v_outcome uuid;
begin
  insert into public.questions (quiz_id, position, type, prompt)
  values (p_quiz, p_position, 'single_choice', p_prompt)
  returning id into v_question;

  for i in 1 .. array_length(p_labels, 1) loop
    insert into public.options (question_id, position, label)
    values (v_question, i, p_labels[i])
    returning id into v_option;

    select id into v_outcome
    from public.outcomes
    where quiz_id = p_quiz and position = p_outcomes[i];

    insert into public.option_keys (option_id, outcome_id, points)
    values (v_option, v_outcome, p_points[i]);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------
insert into public.quizzes (id, creator_id, kind, title, description, suggested_time_seconds)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'trivia',
   'World Capitals', 'Test your knowledge of capital cities around the world.', 300),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'trivia',
   'The Solar System', 'Planets, moons and the space between them.', 240),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'trivia',
   'Amazing Animals', 'Fun facts about creatures on land, in the sea and in the air.', null),
  ('a0000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'trivia',
   'Food Around the World', 'Famous dishes from capital cities and countries everywhere.', null),
  ('a0000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'trivia',
   'General Science', 'Chemistry, physics, biology and a little bit of space.', 600),
  ('a0000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'personality',
   'Which Season Matches You?', 'Find out whether you are spring, summer, autumn or winter.', null),
  ('a0000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'personality',
   'What Kind of Traveller Are You?', 'Discover your travel style before your next trip.', null),
  ('a0000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222', 'personality',
   'Which Pet Suits You?', 'Answer a few questions to find your ideal animal companion.', null),
  ('a0000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'trivia',
   'General Knowledge', 'A quick mix of questions about everything.', null),
  ('a0000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222', 'trivia',
   'General Knowledge', 'Another creator''s mix of everyday trivia.', null);

-- World Capitals
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000001', 1, 'single_choice',
  'What is the capital of Australia?', array['Sydney', 'Canberra', 'Melbourne', 'Perth'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000001', 2, 'true_false',
  'Ottawa is the capital of Canada.', array['True', 'False'], array[1]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000001', 3, 'multi_select',
  'Which of these cities are capitals?', array['Nairobi', 'Lisbon', 'Barcelona', 'Istanbul'], array[1, 2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000001', 4, 'single_choice',
  'What is the capital of Japan?', array['Kyoto', 'Osaka', 'Tokyo'], array[3]);

-- The Solar System
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000002', 1, 'single_choice',
  'Which planet is closest to the Sun?', array['Venus', 'Mercury', 'Mars'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000002', 2, 'multi_select',
  'Which of these are gas giants?', array['Jupiter', 'Saturn', 'Earth', 'Mars'], array[1, 2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000002', 3, 'true_false',
  'Pluto is classed as a dwarf planet.', array['True', 'False'], array[1]);

-- Amazing Animals
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000003', 1, 'single_choice',
  'What is the largest animal on Earth?', array['African elephant', 'Blue whale', 'Giraffe'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000003', 2, 'true_false',
  'Bats are mammals.', array['True', 'False'], array[1]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000003', 3, 'multi_select',
  'Which of these animals can fly?', array['Penguin', 'Albatross', 'Ostrich', 'Hummingbird'], array[2, 4]);

-- Food Around the World
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000004', 1, 'single_choice',
  'Which country is paella from?', array['Italy', 'Spain', 'Mexico'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000004', 2, 'multi_select',
  'Which of these dishes come from Japan?', array['Sushi', 'Ramen', 'Pierogi', 'Tacos'], array[1, 2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000004', 3, 'true_false',
  'Pizza Margherita was first made in Naples.', array['True', 'False'], array[1]);

-- General Science
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000005', 1, 'single_choice',
  'What is the chemical symbol for gold?', array['Go', 'Au', 'Ag', 'Gd'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000005', 2, 'true_false',
  'Sound travels faster in space than in air.', array['True', 'False'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000005', 3, 'multi_select',
  'Which of these are states of matter?', array['Solid', 'Liquid', 'Gas', 'Energy'], array[1, 2, 3]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000005', 4, 'single_choice',
  'What gas do plants take in for photosynthesis?', array['Oxygen', 'Nitrogen', 'Carbon dioxide'], array[3]);

-- General Knowledge (Alex)
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000009', 1, 'single_choice',
  'How many days are in a leap year?', array['365', '366', '364'], array[2]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000009', 2, 'true_false',
  'A spider has eight legs.', array['True', 'False'], array[1]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000009', 3, 'multi_select',
  'Which of these are primary colours of light?', array['Red', 'Green', 'Blue', 'Yellow'], array[1, 2, 3]);

-- General Knowledge (Sam)
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000010', 1, 'single_choice',
  'How many minutes are in an hour?', array['60', '100', '30'], array[1]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000010', 2, 'true_false',
  'Water boils at 100°C at sea level.', array['True', 'False'], array[1]);
select pg_temp.trivia_question('a0000000-0000-4000-8000-000000000010', 3, 'single_choice',
  'Which ocean is the largest?', array['Atlantic', 'Indian', 'Pacific'], array[3]);

-- ---------------------------------------------------------------------------
-- Personality quizzes
-- ---------------------------------------------------------------------------

-- Which Season Matches You? Every option is worth 1 point, so answering
-- Spring, Spring, Summer, Summer ends in a tie between Spring and Summer.
insert into public.outcomes (quiz_id, position, title, description)
values
  ('a0000000-0000-4000-8000-000000000006', 1, 'Spring', 'Fresh, hopeful and always starting something new.'),
  ('a0000000-0000-4000-8000-000000000006', 2, 'Summer', 'Warm, outgoing and happiest in the sunshine.'),
  ('a0000000-0000-4000-8000-000000000006', 3, 'Autumn', 'Thoughtful, cosy and fond of a good book.'),
  ('a0000000-0000-4000-8000-000000000006', 4, 'Winter', 'Calm, quiet and at home by the fire.');

select pg_temp.personality_question('a0000000-0000-4000-8000-000000000006', 1,
  'Pick a weekend activity.',
  array['Planting a garden', 'A day at the beach', 'A walk through the woods', 'Reading under a blanket'],
  array[1, 2, 3, 4], array[1, 1, 1, 1]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000006', 2,
  'Choose a drink.',
  array['Iced tea with mint', 'Lemonade', 'Apple cider', 'Hot chocolate'],
  array[1, 2, 3, 4], array[1, 1, 1, 1]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000006', 3,
  'What colour do you wear most?',
  array['Pastel green', 'Bright yellow', 'Deep orange', 'Navy blue'],
  array[1, 2, 3, 4], array[1, 1, 1, 1]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000006', 4,
  'How do you like to spend an evening?',
  array['Trying a new hobby', 'A barbecue with friends', 'Baking something warm', 'A film at home'],
  array[1, 2, 3, 4], array[1, 1, 1, 1]);

-- What Kind of Traveller Are You?
insert into public.outcomes (quiz_id, position, title, description)
values
  ('a0000000-0000-4000-8000-000000000007', 1, 'The Adventurer', 'You want mountains, rivers and a story to tell.'),
  ('a0000000-0000-4000-8000-000000000007', 2, 'The Relaxer', 'A sunny spot and a good book is all you need.'),
  ('a0000000-0000-4000-8000-000000000007', 3, 'The Culture Seeker', 'Museums, markets and local food are your map.');

select pg_temp.personality_question('a0000000-0000-4000-8000-000000000007', 1,
  'What do you pack first?',
  array['Hiking boots', 'Sunscreen', 'A city guidebook'],
  array[1, 2, 3], array[2, 1, 2]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000007', 2,
  'Your ideal morning on holiday?',
  array['An early trek', 'Sleeping in', 'Coffee at a local café'],
  array[1, 2, 3], array[1, 2, 1]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000007', 3,
  'Pick a souvenir.',
  array['A photo from a summit', 'A seashell', 'A handmade craft'],
  array[1, 2, 3], array[1, 1, 3]);

-- Which Pet Suits You?
insert into public.outcomes (quiz_id, position, title, description)
values
  ('a0000000-0000-4000-8000-000000000008', 1, 'Dog', 'Loyal, energetic and always up for a walk.'),
  ('a0000000-0000-4000-8000-000000000008', 2, 'Cat', 'Independent, curious and quietly affectionate.'),
  ('a0000000-0000-4000-8000-000000000008', 3, 'Fish', 'Peaceful and easy-going, with a calming presence.');

select pg_temp.personality_question('a0000000-0000-4000-8000-000000000008', 1,
  'How active are you?',
  array['Very active', 'Somewhat active', 'I prefer to relax'],
  array[1, 2, 3], array[3, 1, 2]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000008', 2,
  'How much space do you have at home?',
  array['A house with a garden', 'A flat', 'A small room'],
  array[1, 2, 3], array[2, 2, 1]);
select pg_temp.personality_question('a0000000-0000-4000-8000-000000000008', 3,
  'How much time can you spend on a pet each day?',
  array['A few hours', 'An hour or so', 'A few minutes'],
  array[1, 2, 3], array[2, 1, 3]);
