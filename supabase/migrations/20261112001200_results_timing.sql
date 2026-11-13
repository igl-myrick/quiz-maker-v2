-- Timed takes (feature 1, criterion 18). Approved by the project owner (2026-11-10).
--   timed             whether the taker chose to use the timer
--   duration_seconds  timed takes only: from the reported start time to submission,
--                     capped at 24 hours. Advisory only, never used for grading.

alter table public.results
  add column timed boolean not null default false,
  add column duration_seconds int null check (duration_seconds >= 0);

-- Members can read these columns on their own results, like the others.
grant select (timed, duration_seconds) on table public.results to authenticated;

-- get_result, unchanged from feature 0 except that it also returns timed and duration_seconds.
create or replace function public.get_result(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.results;
  v_current_version int;
  v_snapshot jsonb;
  v_winning_outcome jsonb;
begin
  select * into r from public.results where id = p_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Check expiry on every read; never rely on the cleanup job.
  if r.expires_at is not null and r.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  if r.quiz_id is not null then
    select version into v_current_version from public.quizzes where id = r.quiz_id;
  end if;

  if r.quiz_kind = 'personality' then
    -- Rebuild each question with its options stripped of their outcome mapping.
    v_snapshot := (r.snapshot - 'outcomes') || jsonb_build_object(
      'questions',
      coalesce(
        (
          select jsonb_agg(
            question || jsonb_build_object(
              'options',
              coalesce(
                (
                  select jsonb_agg(opt - 'outcome_id' - 'points' order by opt_order)
                  from jsonb_array_elements(question -> 'options') with ordinality as o (opt, opt_order)
                ),
                '[]'::jsonb
              )
            )
            order by question_order
          )
          from jsonb_array_elements(r.snapshot -> 'questions') with ordinality as q (question, question_order)
        ),
        '[]'::jsonb
      )
    );

    -- The winning outcome is the first entry of the stored ranking.
    select jsonb_build_object(
      'id', outcome ->> 'id',
      'title', outcome ->> 'title',
      'description', outcome ->> 'description'
    )
    into v_winning_outcome
    from jsonb_array_elements(r.snapshot -> 'outcomes') as outcome
    where outcome ->> 'id' = r.outcome_ranking -> 0 ->> 'outcome_id';
  else
    v_snapshot := r.snapshot;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'quiz_exists', r.quiz_id is not null,
    'quiz_updated', coalesce(v_current_version > r.quiz_version, false),
    'claimable', r.owner_id is null,
    'result', jsonb_build_object(
      'id', r.id,
      'quiz_id', r.quiz_id,
      'quiz_version', r.quiz_version,
      'quiz_kind', r.quiz_kind,
      'quiz_title', r.quiz_title,
      'created_at', r.created_at,
      'expires_at', r.expires_at,
      'score', r.score,
      'snapshot', v_snapshot,
      'winning_outcome', v_winning_outcome,
      'timed', r.timed,
      'duration_seconds', r.duration_seconds
    )
  );
end;
$$;

revoke execute on function public.get_result(uuid) from public, anon, authenticated;
grant execute on function public.get_result(uuid) to anon, authenticated;
