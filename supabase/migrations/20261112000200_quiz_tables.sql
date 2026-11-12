-- Quizzes and their content (ARCHITECTURE_SPEC.md 4.2 to 4.4).
-- Text and count limits are added by feature 2.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  kind public.quiz_kind not null,
  title text not null,
  -- Collapse all whitespace to single spaces, trim, then lowercase.
  normalized_title text generated always as (
    lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))
  ) stored,
  description text not null default '',
  suggested_time_seconds int null check (suggested_time_seconds > 0),
  version int not null default 1,
  search tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', description), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_creator_title_unique unique (creator_id, normalized_title)
);

create index quizzes_search_idx on public.quizzes using gin (search);
create index quizzes_creator_created_idx on public.quizzes (creator_id, created_at desc);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null,
  type public.question_type not null,
  prompt text not null,
  constraint questions_quiz_position_unique unique (quiz_id, position)
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position int not null,
  label text not null,
  constraint options_question_position_unique unique (question_id, position)
);

create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null,
  title text not null,
  description text not null default '',
  constraint outcomes_quiz_position_unique unique (quiz_id, position)
);

-- The private answer key: one row per option, never readable by clients.
create table public.option_keys (
  option_id uuid primary key references public.options (id) on delete cascade,
  is_correct boolean null,
  outcome_id uuid null references public.outcomes (id) on delete cascade,
  points int null check (points between 1 and 3),
  constraint option_keys_one_shape check (
    (is_correct is not null and outcome_id is null and points is null) or
    (is_correct is null and outcome_id is not null and points is not null)
  )
);

create index option_keys_outcome_idx on public.option_keys (outcome_id);
