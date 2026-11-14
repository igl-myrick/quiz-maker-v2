import { PersonalityResult } from 'quiz-maker'

export function Outcome() {
  return (
    <PersonalityResult
      result={{
        id: '5a2d8c14-7e3b-4f91-a6c0-2b8e9d1f4c77',
        quiz_id: '2b9e4d17-8a3c-4f60-b2d5-7c1e9f0a6d33',
        quiz_version: 2,
        quiz_kind: 'personality',
        quiz_title: 'Which Houseplant Are You?',
        created_at: '2026-11-12T18:24:00Z',
        expires_at: null,
        score: null,
        snapshot: { quiz: { suggested_time_seconds: null }, questions: [] },
        winning_outcome: {
          id: 'snake-plant',
          title: 'a Snake Plant',
          description:
            'Calm, steady and hard to rattle. You thrive on a little neglect and still look great on a Monday.',
        },
        timed: false,
        duration_seconds: null,
      }}
    />
  )
}
