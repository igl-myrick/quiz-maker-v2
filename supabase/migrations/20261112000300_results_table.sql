-- Results (ARCHITECTURE_SPEC.md 4.5). The timing columns are added by feature 1.

create table public.results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references auth.users (id) on delete cascade,
  -- Never cascades: a result outlives its quiz.
  quiz_id uuid null references public.quizzes (id) on delete set null,
  quiz_version int not null,
  quiz_kind public.quiz_kind not null,
  quiz_title text not null,
  snapshot jsonb not null,
  score numeric(5, 4) null check (score between 0 and 1),
  outcome_ranking jsonb null,
  expires_at timestamptz null,
  claim_token_hash text null,
  created_at timestamptz not null default now(),
  -- Owned results never expire and have no token; anonymous results always do.
  constraint results_owned_or_expiring check (
    (owner_id is not null and expires_at is null and claim_token_hash is null) or
    (owner_id is null and expires_at is not null and claim_token_hash is not null)
  ),
  constraint results_trivia_has_score check ((quiz_kind = 'trivia') = (score is not null)),
  constraint results_personality_has_ranking check (
    (quiz_kind = 'personality') = (outcome_ranking is not null)
  )
);

create index results_owner_created_idx on public.results (owner_id, created_at desc, id);
create index results_quiz_idx on public.results (quiz_id);
create index results_expiry_idx on public.results (expires_at) where owner_id is null;
