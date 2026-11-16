import { QuizCard } from 'quiz-maker'

export function Trivia() {
  return (
    <QuizCard
      quiz={{
        id: '6f1c2a0e-1b7d-4c2e-9a51-0d3f8e2b7c41',
        kind: 'trivia',
        title: 'World Capitals',
        description:
          'Can you name the capital city of each country? Twelve questions, from easy to tricky.',
        question_count: 12,
        suggested_time_seconds: 300,
      }}
    />
  )
}

export function Personality() {
  return (
    <QuizCard
      quiz={{
        id: '2b9e4d17-8a3c-4f60-b2d5-7c1e9f0a6d33',
        kind: 'personality',
        title: 'Which Houseplant Are You?',
        description: 'Answer a few questions about your weekends and find your leafy match.',
        question_count: 8,
        suggested_time_seconds: null,
      }}
    />
  )
}

export function WithActions() {
  return (
    <QuizCard
      quiz={{
        id: '9d4a7b62-3e15-4c88-a0f2-51b6c8e3d907',
        kind: 'trivia',
        title: 'Solar System Basics',
        description: 'Planets, moons and a few surprises.',
        question_count: 10,
        suggested_time_seconds: 240,
      }}
      actions={
        <div className="btn-group">
          <a className="btn" href="#edit">
            Edit
          </a>
          <button type="button" className="btn">
            Delete
          </button>
        </div>
      }
    />
  )
}
