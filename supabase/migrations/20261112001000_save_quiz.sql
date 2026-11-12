-- save_quiz and get_quiz_for_edit (ARCHITECTURE_SPEC.md 7.1, feature 2 criteria 21 and 25).
--
-- save_quiz is the only way to create or edit a quiz. It re-checks every rule in
-- CLAUDE.md section 1 and the limits in feature 2's spec, because the browser can't be
-- trusted. KEEP THE NUMBERS IN STEP WITH src/schemas/quizLimits.ts.
--
-- Every failure raises an exception with errcode P0001 and a stable message code:
--   not_authenticated, not_found, forbidden, stale_version, kind_changed,
--   invalid_quiz (detail says what is wrong), rate_limited,
--   duplicate_title (detail holds the ID of the creator's existing quiz with that title)
-- Raising rolls back the whole call, including the rate-limit hit, so failed saves
-- never count toward the creation limit.

-- Trims whitespace, including tabs and newlines, from both ends. Null becomes ''.
create function public.trim_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_text, ''), '^\s+|\s+$', '', 'g')
$$;

revoke execute on function public.trim_text(text) from public, anon, authenticated;

create function public.save_quiz(p_quiz jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := (p_quiz ->> 'id')::uuid;
  v_is_edit boolean := (p_quiz ->> 'id') is not null;
  v_kind public.quiz_kind;
  v_title text := public.trim_text(p_quiz ->> 'title');
  v_description text := public.trim_text(p_quiz ->> 'description');
  v_suggested int;
  v_outcomes jsonb := coalesce(p_quiz -> 'outcomes', '[]'::jsonb);
  v_questions jsonb := coalesce(p_quiz -> 'questions', '[]'::jsonb);
  v_existing public.quizzes;
  v_version int;
  v_duplicate_id uuid;
  -- Validation state
  v_outcome_keys text[] := '{}';
  v_used_keys text[] := '{}';
  v_outcome jsonb;
  v_question jsonb;
  v_option jsonb;
  v_index int;
  v_type public.question_type;
  v_options jsonb;
  v_labels text[];
  v_correct int;
  v_wrong int;
  v_key text;
  -- Writing state
  v_outcome_ids jsonb := '{}';
  v_new_id uuid;
  v_question_id uuid;
  v_option_id uuid;
  v_position int;
  v_option_position int;
begin
  -- 1. Who is calling, and may they edit this quiz?
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  begin
    v_kind := (p_quiz ->> 'kind')::public.quiz_kind;
  exception when invalid_text_representation then
    v_kind := null;
  end;
  if v_kind is null then
    raise exception 'invalid_quiz' using errcode = 'P0001', detail = 'Choose trivia or personality.';
  end if;

  if v_is_edit then
    select * into v_existing from public.quizzes where id = v_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if v_existing.creator_id <> v_uid then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    if (p_quiz ->> 'expected_version')::int is distinct from v_existing.version then
      raise exception 'stale_version' using errcode = 'P0001';
    end if;
    if v_kind <> v_existing.kind then
      raise exception 'kind_changed' using errcode = 'P0001';
    end if;
  end if;

  -- 2. Basics
  if char_length(v_title) not between 3 and 75 then
    raise exception 'invalid_quiz' using errcode = 'P0001', detail = 'The title must be 3 to 75 characters.';
  end if;
  if char_length(v_description) > 250 then
    raise exception 'invalid_quiz' using errcode = 'P0001', detail = 'The description can be up to 250 characters.';
  end if;

  if jsonb_typeof(p_quiz -> 'suggested_time_seconds') = 'number' then
    v_suggested := (p_quiz ->> 'suggested_time_seconds')::int;
    if not (v_suggested between 60 and 10800 and v_suggested % 60 = 0) then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = 'The suggested time must be 1 to 180 whole minutes.';
    end if;
  elsif coalesce(jsonb_typeof(p_quiz -> 'suggested_time_seconds'), 'null') <> 'null' then
    raise exception 'invalid_quiz' using errcode = 'P0001',
      detail = 'The suggested time must be 1 to 180 whole minutes.';
  end if;

  if jsonb_typeof(v_outcomes) is distinct from 'array'
     or jsonb_typeof(v_questions) is distinct from 'array' then
    raise exception 'invalid_quiz' using errcode = 'P0001', detail = 'Outcomes and questions must be lists.';
  end if;

  -- 3. Outcomes: personality quizzes have 2 to 30, trivia quizzes have none
  if v_kind = 'personality' then
    if jsonb_array_length(v_outcomes) not between 2 and 30 then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = 'A personality quiz needs 2 to 30 outcomes.';
    end if;

    for v_outcome, v_index in
      select value, ordinality::int from jsonb_array_elements(v_outcomes) with ordinality
    loop
      v_key := v_outcome ->> 'key';
      if v_key is null or v_key = any (v_outcome_keys) then
        raise exception 'invalid_quiz' using errcode = 'P0001',
          detail = format('Outcome %s needs its own key.', v_index);
      end if;
      if char_length(public.trim_text(v_outcome ->> 'title')) not between 1 and 80 then
        raise exception 'invalid_quiz' using errcode = 'P0001',
          detail = format('Outcome %s: the name must be 1 to 80 characters.', v_index);
      end if;
      if char_length(public.trim_text(v_outcome ->> 'description')) > 500 then
        raise exception 'invalid_quiz' using errcode = 'P0001',
          detail = format('Outcome %s: the description can be up to 500 characters.', v_index);
      end if;
      v_outcome_keys := v_outcome_keys || v_key;
    end loop;
  elsif jsonb_array_length(v_outcomes) > 0 then
    raise exception 'invalid_quiz' using errcode = 'P0001', detail = 'Trivia quizzes have no outcomes.';
  end if;

  -- 4. Questions and their answers
  if jsonb_array_length(v_questions) not between 3 and 50 then
    raise exception 'invalid_quiz' using errcode = 'P0001', detail = 'A quiz needs 3 to 50 questions.';
  end if;

  for v_question, v_index in
    select value, ordinality::int from jsonb_array_elements(v_questions) with ordinality
  loop
    begin
      v_type := (v_question ->> 'type')::public.question_type;
    exception when invalid_text_representation then
      v_type := null;
    end;
    if v_type is null then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s: choose a question type.', v_index);
    end if;
    if v_kind = 'personality' and v_type <> 'single_choice' then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s: personality questions are single-choice.', v_index);
    end if;
    if char_length(public.trim_text(v_question ->> 'prompt')) not between 1 and 300 then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s: the question must be 1 to 300 characters.', v_index);
    end if;

    v_options := v_question -> 'options';
    if jsonb_typeof(v_options) is distinct from 'array'
       or jsonb_array_length(v_options) not between 2 and 8 then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s needs 2 to 8 answers.', v_index);
    end if;

    v_labels := '{}';
    v_correct := 0;
    v_wrong := 0;

    for v_option in select value from jsonb_array_elements(v_options) loop
      if char_length(public.trim_text(v_option ->> 'label')) not between 1 and 150 then
        raise exception 'invalid_quiz' using errcode = 'P0001',
          detail = format('Question %s: every answer needs 1 to 150 characters.', v_index);
      end if;
      v_labels := v_labels || public.trim_text(v_option ->> 'label');

      if v_kind = 'trivia' then
        -- Trivia answers are marked correct or not, and have no outcome or points.
        if jsonb_typeof(v_option -> 'is_correct') is distinct from 'boolean'
           or v_option ? 'outcome_key' or v_option ? 'points' then
          raise exception 'invalid_quiz' using errcode = 'P0001',
            detail = format('Question %s: mark each answer correct or not.', v_index);
        end if;
        if (v_option ->> 'is_correct')::boolean then
          v_correct := v_correct + 1;
        else
          v_wrong := v_wrong + 1;
        end if;
      else
        -- Personality answers point to one of this quiz's outcomes, worth 1, 2 or 3 points.
        v_key := v_option ->> 'outcome_key';
        if v_option ? 'is_correct' or v_key is null or not (v_key = any (v_outcome_keys)) then
          raise exception 'invalid_quiz' using errcode = 'P0001',
            detail = format('Question %s: every answer needs one of this quiz''s outcomes.', v_index);
        end if;
        if jsonb_typeof(v_option -> 'points') is distinct from 'number'
           or (v_option ->> 'points')::numeric not in (1, 2, 3) then
          raise exception 'invalid_quiz' using errcode = 'P0001',
            detail = format('Question %s: every answer is worth 1, 2 or 3 points.', v_index);
        end if;
        v_used_keys := v_used_keys || v_key;
      end if;
    end loop;

    if v_type = 'single_choice' and v_kind = 'trivia' and v_correct <> 1 then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s: mark exactly 1 correct answer.', v_index);
    end if;
    if v_type = 'true_false' and (
      jsonb_array_length(v_options) <> 2
      or v_correct <> 1
      or (select array_agg(l order by l) from unnest(v_labels) as l) <> array['False', 'True']
    ) then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s: true/false answers are True and False, with 1 correct.', v_index);
    end if;
    if v_type = 'multi_select' and (v_correct < 1 or v_wrong < 1) then
      raise exception 'invalid_quiz' using errcode = 'P0001',
        detail = format('Question %s: mark at least 1 correct and 1 incorrect answer.', v_index);
    end if;
  end loop;

  if v_kind = 'personality'
     and exists (select 1 from unnest(v_outcome_keys) as k where not (k = any (v_used_keys))) then
    raise exception 'invalid_quiz' using errcode = 'P0001',
      detail = 'Every outcome needs at least 1 answer pointing to it.';
  end if;

  -- 5. The creation limit: 10 new quizzes per member per hour. Edits aren't limited.
  if not v_is_edit
     and not public.hit_rate_limit('quiz_create', v_uid::text, 10, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- 6. Write the quiz row. A clash on the per-creator title index becomes duplicate_title.
  begin
    if v_is_edit then
      update public.quizzes
      set title = v_title,
          description = v_description,
          suggested_time_seconds = v_suggested,
          version = version + 1,
          updated_at = now()
      where id = v_id
      returning version into v_version;
    else
      insert into public.quizzes (creator_id, kind, title, description, suggested_time_seconds)
      values (v_uid, v_kind, v_title, v_description, v_suggested)
      returning id, version into v_id, v_version;
    end if;
  exception when unique_violation then
    select id into v_duplicate_id
    from public.quizzes
    where creator_id = v_uid
      and normalized_title = lower(btrim(regexp_replace(v_title, '\s+', ' ', 'g')))
      and id is distinct from v_id
    limit 1;
    raise exception 'duplicate_title' using errcode = 'P0001', detail = coalesce(v_duplicate_id::text, '');
  end;

  -- 7. Replace the child rows. Existing results keep their own snapshots.
  if v_is_edit then
    delete from public.questions where quiz_id = v_id;
    delete from public.outcomes where quiz_id = v_id;
  end if;

  for v_outcome, v_position in
    select value, ordinality::int from jsonb_array_elements(v_outcomes) with ordinality
  loop
    insert into public.outcomes (quiz_id, position, title, description)
    values (
      v_id, v_position,
      public.trim_text(v_outcome ->> 'title'),
      public.trim_text(v_outcome ->> 'description')
    )
    returning id into v_new_id;
    v_outcome_ids := v_outcome_ids || jsonb_build_object(v_outcome ->> 'key', v_new_id);
  end loop;

  for v_question, v_position in
    select value, ordinality::int from jsonb_array_elements(v_questions) with ordinality
  loop
    insert into public.questions (quiz_id, position, type, prompt)
    values (
      v_id, v_position,
      (v_question ->> 'type')::public.question_type,
      public.trim_text(v_question ->> 'prompt')
    )
    returning id into v_question_id;

    for v_option, v_option_position in
      select value, ordinality::int from jsonb_array_elements(v_question -> 'options') with ordinality
    loop
      insert into public.options (question_id, position, label)
      values (v_question_id, v_option_position, public.trim_text(v_option ->> 'label'))
      returning id into v_option_id;

      if v_kind = 'trivia' then
        insert into public.option_keys (option_id, is_correct)
        values (v_option_id, (v_option ->> 'is_correct')::boolean);
      else
        insert into public.option_keys (option_id, outcome_id, points)
        values (
          v_option_id,
          (v_outcome_ids ->> (v_option ->> 'outcome_key'))::uuid,
          (v_option ->> 'points')::int
        );
      end if;
    end loop;
  end loop;

  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

revoke execute on function public.save_quiz(jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz(jsonb) to authenticated;

-- The full quiz, answer key included, in the same shape save_quiz takes.
-- Only the quiz's creator gets it. Outcome IDs come back as keys.
create function public.get_quiz_for_edit(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = p_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_quiz.creator_id <> auth.uid() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'quiz', jsonb_build_object(
      'id', v_quiz.id,
      'version', v_quiz.version,
      'kind', v_quiz.kind,
      'title', v_quiz.title,
      'description', v_quiz.description,
      'suggested_time_seconds', v_quiz.suggested_time_seconds,
      'outcomes', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('key', o.id, 'title', o.title, 'description', o.description)
            order by o.position
          )
          from public.outcomes o
          where o.quiz_id = v_quiz.id
        ),
        '[]'::jsonb
      ),
      'questions', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'type', q.type,
              'prompt', q.prompt,
              'options', (
                select jsonb_agg(
                  case
                    when v_quiz.kind = 'trivia'
                      then jsonb_build_object('label', op.label, 'is_correct', k.is_correct)
                    else jsonb_build_object('label', op.label, 'outcome_key', k.outcome_id, 'points', k.points)
                  end
                  order by op.position
                )
                from public.options op
                join public.option_keys k on k.option_id = op.id
                where op.question_id = q.id
              )
            )
            order by q.position
          )
          from public.questions q
          where q.quiz_id = v_quiz.id
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke execute on function public.get_quiz_for_edit(uuid) from public, anon, authenticated;
grant execute on function public.get_quiz_for_edit(uuid) to authenticated;
