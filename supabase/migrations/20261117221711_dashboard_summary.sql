-- The dashboard's summary tiles (feature 7, specs/07-ui-redesign.md P5.1).
-- Returns { results_saved, quizzes_made, average_trivia_score } for the caller only.
-- Computed on read: no new tables, columns or stored data.
--
-- security definer, because authenticated has no select grant on quizzes.creator_id, so
-- counting the caller's quizzes would be refused (the same reason as list_my_quizzes).
-- It filters explicitly on the caller everywhere and returns only the three figures,
-- never creator_id or any account field. Anonymous results have no owner, so they can
-- never be counted.
create function public.get_my_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'get_my_dashboard_summary requires a logged-in member' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'results_saved', (select count(*) from public.results where owner_id = v_uid),
    'quizzes_made', (select count(*) from public.quizzes where creator_id = v_uid),
    -- Each trivia score is 0 to 1; null when the caller has no trivia results.
    'average_trivia_score', (
      select avg(score)
      from public.results
      where owner_id = v_uid and quiz_kind = 'trivia' and score is not null
    )
  );
end;
$$;

revoke execute on function public.get_my_dashboard_summary() from public, anon, authenticated;
grant execute on function public.get_my_dashboard_summary() to authenticated;
