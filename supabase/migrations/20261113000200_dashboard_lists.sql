-- The dashboard's two lists (feature 3, criteria 6 and 11). Both return
-- { items, next_cursor }, newest first, with a keyset cursor { created_at, id }.

-- list_my_results: the caller's saved results, with narrow fields only.
--
-- security invoker (an exception to "all definer", ARCHITECTURE_SPEC.md 6.3): RLS and the column
-- grants on results already let a member read every column used here, and never
-- claim_token_hash. The owner filter is repeated so the intent is explicit and the
-- (owner_id, created_at desc, id) index is used. Anonymous results have no owner, so they
-- can never appear.
create function public.list_my_results(p_cursor jsonb default null, p_limit int default 20)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(page.row_json order by page.created_at desc, page.id desc), '[]'::jsonb)
  into v_rows
  from (
    select
      r.created_at,
      r.id,
      jsonb_build_object(
        'item', jsonb_build_object(
          'id', r.id,
          'quiz_kind', r.quiz_kind,
          'quiz_title', r.quiz_title,
          'created_at', r.created_at,
          'score', r.score,
          'question_count', case
            when r.quiz_kind = 'trivia' then jsonb_array_length(r.snapshot -> 'questions')
          end,
          'winning_outcome_title', case
            when r.quiz_kind = 'personality' then (
              select outcome ->> 'title'
              from jsonb_array_elements(r.snapshot -> 'outcomes') as outcome
              where outcome ->> 'id' = r.outcome_ranking -> 0 ->> 'outcome_id'
            )
          end,
          -- The same checks as get_result: deleted when the quiz is gone, updated when the
          -- live quiz has a higher version than the one taken.
          'quiz_status', case
            when r.quiz_id is null then 'deleted'
            when q.version > r.quiz_version then 'updated'
            else 'current'
          end
        ),
        'cursor', jsonb_build_object('created_at', r.created_at, 'id', r.id)
      ) as row_json
    from public.results r
    left join public.quizzes_public q on q.id = r.quiz_id
    where r.owner_id = (select auth.uid())
      and (
        p_cursor is null
        or (r.created_at, r.id)
           < ((p_cursor ->> 'created_at')::timestamptz, (p_cursor ->> 'id')::uuid)
      )
    order by r.created_at desc, r.id desc
    -- One extra row tells whether another page exists.
    limit v_limit + 1
  ) page;

  return jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(r.value -> 'item' order by r.ordinality)
        from jsonb_array_elements(v_rows) with ordinality as r (value, ordinality)
        where r.ordinality <= v_limit
      ),
      '[]'::jsonb
    ),
    'next_cursor', case
      when jsonb_array_length(v_rows) > v_limit then v_rows -> (v_limit - 1) -> 'cursor'
      else null
    end
  );
end;
$$;

revoke execute on function public.list_my_results(jsonb, int) from public, anon, authenticated;
grant execute on function public.list_my_results(jsonb, int) to authenticated;

-- list_my_quizzes: the caller's own quizzes, in the same shape as a search_quizzes item.
--
-- security definer, because authenticated has no select grant on quizzes.creator_id, so
-- even filtering on it would be refused. It filters explicitly on the caller and never
-- outputs creator_id. Uses the (creator_id, created_at desc) index.
create function public.list_my_quizzes(p_cursor jsonb default null, p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'list_my_quizzes requires a logged-in member' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(page.row_json order by page.created_at desc, page.id desc), '[]'::jsonb)
  into v_rows
  from (
    select
      q.created_at,
      q.id,
      jsonb_build_object(
        'item', jsonb_build_object(
          'id', q.id,
          'kind', q.kind,
          'title', q.title,
          'description', q.description,
          'question_count', (select count(*) from public.questions where quiz_id = q.id),
          'suggested_time_seconds', q.suggested_time_seconds,
          'created_at', q.created_at
        ),
        'cursor', jsonb_build_object('created_at', q.created_at, 'id', q.id)
      ) as row_json
    from public.quizzes q
    where q.creator_id = v_uid
      and (
        p_cursor is null
        or (q.created_at, q.id)
           < ((p_cursor ->> 'created_at')::timestamptz, (p_cursor ->> 'id')::uuid)
      )
    order by q.created_at desc, q.id desc
    -- One extra row tells whether another page exists.
    limit v_limit + 1
  ) page;

  return jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(r.value -> 'item' order by r.ordinality)
        from jsonb_array_elements(v_rows) with ordinality as r (value, ordinality)
        where r.ordinality <= v_limit
      ),
      '[]'::jsonb
    ),
    'next_cursor', case
      when jsonb_array_length(v_rows) > v_limit then v_rows -> (v_limit - 1) -> 'cursor'
      else null
    end
  );
end;
$$;

revoke execute on function public.list_my_quizzes(jsonb, int) from public, anon, authenticated;
grant execute on function public.list_my_quizzes(jsonb, int) to authenticated;
