import { ResultRow } from 'quiz-maker'

export function Trivia() {
  return (
    <ResultRow
      result={{
        id: '0c7e5b1a-4d2f-4e96-8b3a-6f9d2c1e7a58',
        quiz_kind: 'trivia',
        quiz_title: 'World Capitals',
        created_at: '2026-11-12T18:24:00Z',
        score: 0.75,
        question_count: 12,
        winning_outcome_title: null,
        quiz_status: 'current',
      }}
    />
  )
}

export function Personality() {
  return (
    <ResultRow
      result={{
        id: '5a2d8c14-7e3b-4f91-a6c0-2b8e9d1f4c77',
        quiz_kind: 'personality',
        quiz_title: 'Which Houseplant Are You?',
        created_at: '2026-11-03T09:10:00Z',
        score: null,
        question_count: null,
        winning_outcome_title: 'Snake Plant',
        quiz_status: 'updated',
      }}
    />
  )
}

export function QuizDeleted() {
  return (
    <ResultRow
      result={{
        id: '8e1f3a6c-2d47-4b9e-9c05-7a3d1b6e2f90',
        quiz_kind: 'trivia',
        quiz_title: 'Solar System Basics',
        created_at: '2026-10-21T15:42:00Z',
        score: 0.4,
        question_count: 10,
        winning_outcome_title: null,
        quiz_status: 'deleted',
      }}
    />
  )
}
