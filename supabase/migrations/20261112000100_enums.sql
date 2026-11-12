-- Enum types for feature 0. The rate-limit and settings enums arrive with features 2 and 5.
create type public.quiz_kind as enum ('trivia', 'personality');
create type public.question_type as enum ('single_choice', 'true_false', 'multi_select');
