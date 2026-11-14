import { ResultNotices } from 'quiz-maker'

const base = {
  id: '0c7e5b1a-4d2f-4e96-8b3a-6f9d2c1e7a58',
  quiz_id: '6f1c2a0e-1b7d-4c2e-9a51-0d3f8e2b7c41',
  quiz_version: 3,
  quiz_kind: 'trivia' as const,
  quiz_title: 'World Capitals',
  created_at: '2026-11-12T18:24:00Z',
  score: 0.5,
  snapshot: { quiz: { suggested_time_seconds: 300 }, questions: [] },
  winning_outcome: null,
}

export function TimedAndUpdated() {
  return (
    <ResultNotices
      data={{
        status: 'ok',
        quiz_exists: true,
        quiz_updated: true,
        claimable: false,
        result: { ...base, expires_at: null, timed: true, duration_seconds: 188 },
      }}
    />
  )
}

export function AnonymousExpiring() {
  return (
    <ResultNotices
      data={{
        status: 'ok',
        quiz_exists: true,
        quiz_updated: false,
        claimable: true,
        result: {
          ...base,
          expires_at: '2026-11-13T18:24:00Z',
          timed: false,
          duration_seconds: null,
        },
      }}
    />
  )
}

export function QuizDeleted() {
  return (
    <ResultNotices
      data={{
        status: 'ok',
        quiz_exists: false,
        quiz_updated: false,
        claimable: false,
        result: { ...base, quiz_id: null, expires_at: null, timed: false, duration_seconds: null },
      }}
    />
  )
}
