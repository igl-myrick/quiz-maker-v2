-- search_quizzes (feature 6, criterion 15). Runs against the seeded quizzes.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

set local role anon;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
select lives_ok($$select public.search_quizzes(null)$$, 'anon can call search_quizzes');
select ok(
  public.search_quizzes(null)::text !~ 'creator_id',
  'no item contains creator_id'
);

-- ---------------------------------------------------------------------------
-- Browse: every quiz, newest first, paged with no gaps or duplicates
-- ---------------------------------------------------------------------------
select is(public.search_quizzes(null) ->> 'mode', 'browse', 'no query browses');
select is(public.search_quizzes('   ') ->> 'mode', 'browse', 'a blank query browses');
select is(
  (public.search_quizzes(null) ->> 'total')::int,
  (select count(*)::int from public.quizzes_public),
  'browse total counts every quiz'
);

create temporary table pages as
with first_page as (select public.search_quizzes(null, null, 6) as r)
select
  (select r from first_page) as page_1,
  public.search_quizzes(null, (select r -> 'next_cursor' from first_page), 6) as page_2;

select is(
  (
    select count(distinct item ->> 'id')::int
    from pages, jsonb_array_elements((page_1 -> 'items') || (page_2 -> 'items')) as item
  ),
  (select count(*)::int from public.quizzes_public),
  'two pages together hold every quiz exactly once'
);
select is(
  (select page_2 -> 'next_cursor' from pages),
  'null'::jsonb,
  'the last page has no next cursor'
);
select is(
  (
    select array_agg(item ->> 'id' order by ord)
    from pages, jsonb_array_elements((page_1 -> 'items') || (page_2 -> 'items')) with ordinality as e (item, ord)
  ),
  (select array_agg(id::text order by created_at desc, id desc) from public.quizzes_public),
  'browse orders by newest first, then id'
);

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
select is(
  (public.search_quizzes('capital space') ->> 'total')::int, 0,
  'two words that never appear together match nothing'
);
select is(
  (select array_agg(item ->> 'title') from jsonb_array_elements(public.search_quizzes('capital dishes') -> 'items') item),
  array['Food Around the World'],
  'a two-word query needs both words'
);
select is(
  (public.search_quizzes('capital') ->> 'total')::int, 2,
  'a one-word query needs just that word'
);
select is(
  public.search_quizzes('capital') -> 'items' -> 0 ->> 'title', 'World Capitals',
  'a title match ranks above a description-only match'
);
select is(
  (select array_agg(item ->> 'title') from jsonb_array_elements(public.search_quizzes('planets of the solar system') -> 'items') item),
  array['The Solar System'],
  'stop words are ignored and stemmed words still match'
);
select is(
  public.search_quizzes('the of'),
  '{"mode": "no_terms", "total": 0, "items": [], "next_cursor": null}'::jsonb,
  'a query of only stop words returns no_terms'
);

-- ---------------------------------------------------------------------------
-- The page size is clamped to 1..50
-- ---------------------------------------------------------------------------
reset role;
insert into public.quizzes (creator_id, kind, title)
select '11111111-1111-4111-8111-111111111111', 'trivia', 'Extra quiz ' || n
from generate_series(1, 50) as n;
set local role anon;

select is(
  jsonb_array_length(public.search_quizzes(null, null, 0) -> 'items'), 1,
  'a page size below 1 becomes 1'
);
select is(
  jsonb_array_length(public.search_quizzes(null, null, 1000) -> 'items'), 50,
  'a page size above 50 becomes 50'
);
select isnt(
  public.search_quizzes(null, null, 1000) -> 'next_cursor', 'null'::jsonb,
  'a clamped page still reports the next page'
);

reset role;
select * from finish();
rollback;
