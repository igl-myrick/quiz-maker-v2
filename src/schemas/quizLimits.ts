// The quiz limits from feature 2's spec, used by the form and its Zod schema.
// KEEP IN STEP WITH the database, which enforces the same numbers in
// supabase/migrations/20261112000800_quiz_limits.sql and ..._save_quiz.sql.
export const QUIZ_LIMITS = {
  titleMin: 3,
  titleMax: 75,
  descriptionMax: 250,
  promptMax: 300,
  answerMax: 150,
  outcomeNameMax: 80,
  outcomeDescriptionMax: 500,
  questionsMin: 3,
  questionsMax: 50,
  answersMin: 2,
  answersMax: 8,
  outcomesMin: 2,
  outcomesMax: 30,
  minutesMin: 1,
  minutesMax: 180,
} as const
