-- search_quizzes: browse or search public quizzes (feature 6, criterion 14).
--
-- Returns { mode, total, items, next_cursor }.
--   browse    no query: every quiz, newest first
--   search    quizzes containing at least 2 of the query's words (or the one word
--             of a one-word query), ranked by words matched, then title match, then newest
--   no_terms  the query had text but no searchable words (only stop words, say)
--
-- security invoker: it runs with the caller's rights and reads only quizzes_public,
-- so it can never expose creator_id. Paging is keyset, with an opaque jsonb cursor.
create function public.search_quizzes(
  p_query text,
  p_cursor jsonb default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_mode text;
  v_lexemes text[];
  v_any_term tsquery;
  v_needed int;
  v_total int;
  v_rows jsonb;
begin
  if p_query is null or btrim(p_query) = '' then
    v_mode := 'browse';

    with kept as (
      select q.*
      from public.quizzes_public q
    )
    select
      (select count(*) from kept),
      (
        select coalesce(jsonb_agg(page.row_json order by page.created_at desc, page.id desc), '[]'::jsonb)
        from (
          select
            k.created_at,
            k.id,
            jsonb_build_object(
              'item', jsonb_build_object(
                'id', k.id,
                'kind', k.kind,
                'title', k.title,
                'description', k.description,
                'question_count', k.question_count,
                'suggested_time_seconds', k.suggested_time_seconds,
                'created_at', k.created_at
              ),
              'cursor', jsonb_build_object('created_at', k.created_at, 'id', k.id)
            ) as row_json
          from kept k
          where p_cursor is null
            or (k.created_at, k.id)
               < ((p_cursor ->> 'created_at')::timestamptz, (p_cursor ->> 'id')::uuid)
          order by k.created_at desc, k.id desc
          limit v_limit + 1
        ) page
      )
    into v_total, v_rows;
  else
    -- The query's normalized, stemmed words, without stop words or duplicates,
    -- in the order they first appear. At most 10 are used.
    select array_agg(words.lexeme order by words.first_position)
    into v_lexemes
    from (
      select t.lexeme, min(p.position) as first_position
      from unnest(to_tsvector('english', p_query)) as t (lexeme, positions, weights)
      cross join lateral unnest(t.positions) as p (position)
      group by t.lexeme
      order by first_position
      limit 10
    ) words;

    if v_lexemes is null then
      return jsonb_build_object('mode', 'no_terms', 'total', 0, 'items', '[]'::jsonb, 'next_cursor', null);
    end if;

    v_mode := 'search';
    v_needed := least(2, cardinality(v_lexemes));
    -- Any one of the words, used to prefilter with the GIN index and to test the title.
    v_any_term := array_to_string(
      array(select quote_literal(l) from unnest(v_lexemes) as l),
      ' | '
    )::tsquery;

    with ranked as (
      select
        q.*,
        (
          select count(*)::int
          from unnest(v_lexemes) as l
          where q.search @@ quote_literal(l)::tsquery
        ) as matched,
        ts_filter(q.search, '{a}') @@ v_any_term as title_match
      from public.quizzes_public q
      where q.search @@ v_any_term
    ),
    kept as (
      select * from ranked where matched >= v_needed
    )
    select
      (select count(*) from kept),
      (
        select coalesce(
          jsonb_agg(
            page.row_json
            order by page.matched desc, page.title_match desc, page.created_at desc, page.id desc
          ),
          '[]'::jsonb
        )
        from (
          select
            k.matched,
            k.title_match,
            k.created_at,
            k.id,
            jsonb_build_object(
              'item', jsonb_build_object(
                'id', k.id,
                'kind', k.kind,
                'title', k.title,
                'description', k.description,
                'question_count', k.question_count,
                'suggested_time_seconds', k.suggested_time_seconds,
                'created_at', k.created_at
              ),
              'cursor', jsonb_build_object(
                'matched', k.matched,
                'title_match', k.title_match,
                'created_at', k.created_at,
                'id', k.id
              )
            ) as row_json
          from kept k
          where p_cursor is null
            or (k.matched, k.title_match, k.created_at, k.id) < (
              (p_cursor ->> 'matched')::int,
              (p_cursor ->> 'title_match')::boolean,
              (p_cursor ->> 'created_at')::timestamptz,
              (p_cursor ->> 'id')::uuid
            )
          order by k.matched desc, k.title_match desc, k.created_at desc, k.id desc
          limit v_limit + 1
        ) page
      )
    into v_total, v_rows;
  end if;

  -- One extra row was fetched to tell whether another page exists.
  return jsonb_build_object(
    'mode', v_mode,
    'total', v_total,
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

revoke execute on function public.search_quizzes(text, jsonb, int) from public, anon, authenticated;
grant execute on function public.search_quizzes(text, jsonb, int) to anon, authenticated;
