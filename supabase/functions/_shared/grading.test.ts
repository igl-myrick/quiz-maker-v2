import { describe, expect, it } from 'vitest'
import {
  checkAnswers,
  gradeQuiz,
  rankOutcomes,
  scoreQuestion,
  type QuizSnapshot,
} from './grading.ts'

const noRandom = () => {
  throw new Error('random should not be needed')
}

function trivia(): QuizSnapshot {
  return {
    snapshot_version: 1,
    quiz: {
      id: 'quiz',
      title: 'Trivia',
      description: '',
      kind: 'trivia',
      version: 2,
      suggested_time_seconds: null,
    },
    outcomes: [],
    questions: [
      {
        id: 'q1',
        position: 1,
        type: 'single_choice',
        prompt: 'Capital of Japan?',
        options: [
          { id: 'q1a', label: 'Kyoto', is_correct: false },
          { id: 'q1b', label: 'Tokyo', is_correct: true },
        ],
      },
      {
        id: 'q2',
        position: 2,
        type: 'true_false',
        prompt: 'Ottawa is in Canada.',
        options: [
          { id: 'q2t', label: 'True', is_correct: true },
          { id: 'q2f', label: 'False', is_correct: false },
        ],
      },
      {
        id: 'q3',
        position: 3,
        type: 'multi_select',
        prompt: 'Which are capitals?',
        options: [
          { id: 'q3a', label: 'Lisbon', is_correct: true },
          { id: 'q3b', label: 'Nairobi', is_correct: true },
          { id: 'q3c', label: 'Barcelona', is_correct: false },
          { id: 'q3d', label: 'Sydney', is_correct: false },
        ],
      },
    ],
  }
}

function personality(): QuizSnapshot {
  const question = (id: string, catPoints: number, dogPoints: number) => ({
    id,
    position: Number(id.slice(1)),
    type: 'single_choice' as const,
    prompt: id,
    options: [
      { id: `${id}cat`, label: 'Cat answer', outcome_id: 'cat', points: catPoints },
      { id: `${id}dog`, label: 'Dog answer', outcome_id: 'dog', points: dogPoints },
    ],
  })
  return {
    snapshot_version: 1,
    quiz: {
      id: 'quiz',
      title: 'Pets',
      description: '',
      kind: 'personality',
      version: 1,
      suggested_time_seconds: null,
    },
    outcomes: [
      { id: 'cat', title: 'Cat', description: '' },
      { id: 'dog', title: 'Dog', description: '' },
      { id: 'fish', title: 'Fish', description: '' },
    ],
    questions: [question('q1', 1, 1), question('q2', 2, 2), question('q3', 3, 1)],
  }
}

describe('checkAnswers', () => {
  it('accepts a full set of answers', () => {
    expect(checkAnswers(trivia(), { q1: ['q1b'], q2: ['q2t'], q3: ['q3a', 'q3c'] })).toBeNull()
  })

  it('names unanswered questions, counting an empty choice as unanswered', () => {
    expect(checkAnswers(trivia(), { q1: ['q1b'], q3: [] })).toEqual({
      code: 'unanswered',
      question_ids: ['q2', 'q3'],
    })
  })

  it('rejects unknown questions and options, repeats, and several choices on a single-answer question', () => {
    const full = { q1: ['q1b'], q2: ['q2t'], q3: ['q3a'] }
    expect(checkAnswers(trivia(), { ...full, nope: ['q1a'] })).toEqual({ code: 'invalid_answers' })
    expect(checkAnswers(trivia(), { ...full, q1: ['q2t'] })).toEqual({ code: 'invalid_answers' })
    expect(checkAnswers(trivia(), { ...full, q3: ['q3a', 'q3a'] })).toEqual({
      code: 'invalid_answers',
    })
    expect(checkAnswers(trivia(), { ...full, q1: ['q1a', 'q1b'] })).toEqual({
      code: 'invalid_answers',
    })
  })
})

describe('scoreQuestion', () => {
  const [single, trueFalse, multi] = trivia().questions

  it('scores single-choice and true/false as 1 or 0', () => {
    expect(scoreQuestion(single, ['q1b'])).toBe(1)
    expect(scoreQuestion(single, ['q1a'])).toBe(0)
    expect(scoreQuestion(trueFalse, ['q2t'])).toBe(1)
    expect(scoreQuestion(trueFalse, ['q2f'])).toBe(0)
  })

  it('gives multi-select partial credit: (correct - wrong) / correct options', () => {
    expect(scoreQuestion(multi, ['q3a', 'q3b'])).toBe(1)
    expect(scoreQuestion(multi, ['q3a'])).toBe(0.5)
    expect(scoreQuestion(multi, ['q3a', 'q3b', 'q3c'])).toBe(0.5)
  })

  it('never scores a multi-select question below 0', () => {
    expect(scoreQuestion(multi, ['q3a', 'q3c', 'q3d'])).toBe(0)
    expect(scoreQuestion(multi, ['q3c', 'q3d'])).toBe(0)
  })
})

describe('gradeQuiz: trivia', () => {
  it('scores the quiz as the mean of its questions, kept to 4 decimals', () => {
    const graded = gradeQuiz(trivia(), { q1: ['q1b'], q2: ['q2f'], q3: ['q3a'] }, noRandom)
    expect(graded.score).toBe(0.5) // (1 + 0 + 0.5) / 3
    expect(graded.outcome_ranking).toBeNull()

    const thirds = gradeQuiz(trivia(), { q1: ['q1b'], q2: ['q2f'], q3: ['q3c'] }, noRandom)
    expect(thirds.score).toBe(0.3333)
  })

  it('records each choice and question score in the snapshot', () => {
    const graded = gradeQuiz(trivia(), { q1: ['q1b'], q2: ['q2f'], q3: ['q3a'] }, noRandom)
    expect(graded.snapshot.quiz.version).toBe(2)
    expect(
      graded.snapshot.questions.map((question) => [question.selected_option_ids, question.score]),
    ).toEqual([
      [['q1b'], 1],
      [['q2f'], 0],
      [['q3a'], 0.5],
    ])
  })
})

describe('gradeQuiz: personality', () => {
  it('totals points per outcome, including outcomes nobody chose', () => {
    const graded = gradeQuiz(
      personality(),
      { q1: ['q1cat'], q2: ['q2cat'], q3: ['q3dog'] },
      noRandom,
    )
    expect(graded.score).toBeNull()
    expect(graded.outcome_ranking).toEqual([
      { outcome_id: 'cat', points: 3 },
      { outcome_id: 'dog', points: 1 },
      { outcome_id: 'fish', points: 0 },
    ])
    expect(graded.snapshot.questions[0]).not.toHaveProperty('score')
  })

  it('breaks a tie with the given random source', () => {
    // Dog 1 + Dog 1 = 2 and Cat 2 = 2 tie; Fish has 0.
    const answers = { q1: ['q1dog'], q2: ['q2cat'], q3: ['q3dog'] }
    const order = (random: () => number) =>
      gradeQuiz(personality(), answers, random).outcome_ranking?.map(
        (outcome) => `${outcome.outcome_id} ${outcome.points}`,
      )

    expect(order(() => 0)).toEqual(['dog 2', 'cat 2', 'fish 0'])
    expect(order(() => 0.999)).toEqual(['cat 2', 'dog 2', 'fish 0'])
  })
})

describe('rankOutcomes', () => {
  const points = new Map([
    ['a', 5],
    ['b', 2],
    ['c', 5],
    ['d', 5],
  ])

  it('orders by points, highest first', () => {
    const ranking = rankOutcomes(points, () => 0.5)
    expect(ranking.map((outcome) => outcome.points)).toEqual([5, 5, 5, 2])
    expect(ranking[3].outcome_id).toBe('b')
  })

  it('shuffles each tied group using the random source', () => {
    // Fisher-Yates over [a, c, d]: with random() = 0 every swap takes index 0.
    expect(
      rankOutcomes(points, () => 0)
        .map((outcome) => outcome.outcome_id)
        .slice(0, 3),
    ).toEqual(['c', 'd', 'a'])
    // With random() just below 1 nothing moves.
    expect(
      rankOutcomes(points, () => 0.999)
        .map((outcome) => outcome.outcome_id)
        .slice(0, 3),
    ).toEqual(['a', 'c', 'd'])
  })

  it('never uses the random source when there are no ties', () => {
    const untied = new Map([
      ['a', 1],
      ['b', 3],
      ['c', 2],
    ])
    expect(rankOutcomes(untied, noRandom).map((outcome) => outcome.outcome_id)).toEqual([
      'b',
      'c',
      'a',
    ])
  })
})
