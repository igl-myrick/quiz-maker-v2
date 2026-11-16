import { TriviaResult } from 'quiz-maker'

export function MixedScores() {
  return (
    <TriviaResult
      result={{
        id: '0c7e5b1a-4d2f-4e96-8b3a-6f9d2c1e7a58',
        quiz_id: '6f1c2a0e-1b7d-4c2e-9a51-0d3f8e2b7c41',
        quiz_version: 3,
        quiz_kind: 'trivia',
        quiz_title: 'World Capitals',
        created_at: '2026-11-12T18:24:00Z',
        expires_at: null,
        score: 0.61,
        snapshot: {
          quiz: { suggested_time_seconds: 300 },
          questions: [
            {
              id: 'q1',
              position: 1,
              type: 'single_choice',
              prompt: 'What is the capital of Australia?',
              options: [
                { id: 'a', label: 'Sydney', is_correct: false },
                { id: 'b', label: 'Canberra', is_correct: true },
                { id: 'c', label: 'Melbourne', is_correct: false },
              ],
              selected_option_ids: ['b'],
              score: 1,
            },
            {
              id: 'q2',
              position: 2,
              type: 'multi_select',
              prompt: 'Which of these cities are capitals?',
              options: [
                { id: 'a', label: 'Ottawa', is_correct: true },
                { id: 'b', label: 'Lima', is_correct: true },
                { id: 'c', label: 'Istanbul', is_correct: false },
              ],
              selected_option_ids: ['a'],
              score: 0.5,
            },
            {
              id: 'q3',
              position: 3,
              type: 'true_false',
              prompt: 'Rio de Janeiro is the capital of Brazil.',
              options: [
                { id: 't', label: 'True', is_correct: false },
                { id: 'f', label: 'False', is_correct: true },
              ],
              selected_option_ids: ['t'],
              score: 0,
            },
          ],
        },
        winning_outcome: null,
        timed: true,
        duration_seconds: 188,
      }}
    />
  )
}
