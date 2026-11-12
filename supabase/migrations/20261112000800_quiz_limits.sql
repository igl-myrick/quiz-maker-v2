-- Quiz text and time limits (feature 2, criterion 24).
-- KEEP IN STEP WITH src/schemas/quizLimits.ts, which holds the same numbers for the form.
-- Row counts (questions, answers, outcomes) are checked in save_quiz, because a
-- constraint can't count rows.
--
-- Text is stored already trimmed. The "= regexp_replace(...)" checks stop untrimmed
-- text (including tabs and newlines at either end) arriving by any other path.

alter table public.quizzes
  add constraint quizzes_title_length check (char_length(title) between 3 and 75),
  add constraint quizzes_title_trimmed check (title = regexp_replace(title, '^\s+|\s+$', '', 'g')),
  add constraint quizzes_description_length check (char_length(description) <= 250),
  add constraint quizzes_description_trimmed
    check (description = regexp_replace(description, '^\s+|\s+$', '', 'g')),
  add constraint quizzes_suggested_time_minutes check (
    suggested_time_seconds is null
    or (suggested_time_seconds between 60 and 10800 and suggested_time_seconds % 60 = 0)
  );

alter table public.questions
  add constraint questions_prompt_length check (char_length(prompt) between 1 and 300),
  add constraint questions_prompt_trimmed check (prompt = regexp_replace(prompt, '^\s+|\s+$', '', 'g'));

alter table public.options
  add constraint options_label_length check (char_length(label) between 1 and 150),
  add constraint options_label_trimmed check (label = regexp_replace(label, '^\s+|\s+$', '', 'g'));

alter table public.outcomes
  add constraint outcomes_title_length check (char_length(title) between 1 and 80),
  add constraint outcomes_title_trimmed check (title = regexp_replace(title, '^\s+|\s+$', '', 'g')),
  add constraint outcomes_description_length check (char_length(description) <= 500),
  add constraint outcomes_description_trimmed
    check (description = regexp_replace(description, '^\s+|\s+$', '', 'g'));
