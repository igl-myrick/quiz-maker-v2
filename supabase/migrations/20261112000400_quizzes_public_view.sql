-- Public quiz reads without creator_id (ARCHITECTURE_SPEC.md 6.3).
-- security_invoker means the caller's column grants and RLS still apply.
create view public.quizzes_public with (security_invoker = true) as
select
  q.id,
  q.kind,
  q.title,
  q.description,
  q.suggested_time_seconds,
  q.version,
  q.created_at,
  q.updated_at,
  q.search,
  (select count(*) from public.questions where quiz_id = q.id) as question_count
from public.quizzes q;
