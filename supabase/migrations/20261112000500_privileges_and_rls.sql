-- Privileges and RLS (ARCHITECTURE_SPEC.md 6.1 and 6.2).
-- Pattern: enable RLS, revoke everything, then grant only what is needed, with a matching policy.

-- quizzes: everyone reads every column except creator_id. Creators delete their own.
-- Inserts and updates happen only through save_quiz (feature 2).
alter table public.quizzes enable row level security;
revoke all on table public.quizzes from anon, authenticated;
grant select (
  id, kind, title, description, suggested_time_seconds, version, created_at, updated_at, search
) on table public.quizzes to anon, authenticated;
grant delete on table public.quizzes to authenticated;

create policy "Quizzes are readable by everyone"
  on public.quizzes for select to anon, authenticated
  using (true);

create policy "Creators can delete their own quizzes"
  on public.quizzes for delete to authenticated
  using (creator_id = (select auth.uid()));

-- questions, options, outcomes: readable by everyone so quizzes can be taken.
alter table public.questions enable row level security;
revoke all on table public.questions from anon, authenticated;
grant select on table public.questions to anon, authenticated;
create policy "Questions are readable by everyone"
  on public.questions for select to anon, authenticated
  using (true);

alter table public.options enable row level security;
revoke all on table public.options from anon, authenticated;
grant select on table public.options to anon, authenticated;
create policy "Options are readable by everyone"
  on public.options for select to anon, authenticated
  using (true);

alter table public.outcomes enable row level security;
revoke all on table public.outcomes from anon, authenticated;
grant select on table public.outcomes to anon, authenticated;
create policy "Outcomes are readable by everyone"
  on public.outcomes for select to anon, authenticated
  using (true);

-- option_keys: no client access at all. Only service_role (grading) and definer functions.
alter table public.option_keys enable row level security;
revoke all on table public.option_keys from anon, authenticated;

-- results: no anonymous access. Members read their own rows, without claim_token_hash.
-- No client role may insert, update or delete. service_role may only insert and read.
alter table public.results enable row level security;
revoke all on table public.results from anon, authenticated, service_role;
grant select (
  id, owner_id, quiz_id, quiz_version, quiz_kind, quiz_title, snapshot, score,
  outcome_ranking, expires_at, created_at
) on table public.results to authenticated;
grant select, insert on table public.results to service_role;

create policy "Members can read their own results"
  on public.results for select to authenticated
  using (owner_id = (select auth.uid()));

-- quizzes_public: the view everyone reads quizzes through.
revoke all on table public.quizzes_public from anon, authenticated;
grant select on table public.quizzes_public to anon, authenticated;
