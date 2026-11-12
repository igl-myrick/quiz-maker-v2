import { describe, expect, it } from 'vitest'
import {
  emptyQuestion,
  emptyQuizValues,
  fromSavedQuiz,
  quizFormSchema,
  toSavePayload,
  type QuizFormInput,
  type SavedQuiz,
} from './quiz'

function validTrivia(): QuizFormInput {
  return {
    kind: 'trivia',
    title: 'World Capitals',
    description: '',
    hasSuggestedTime: 'no',
    suggestedMinutes: '',
    outcomes: [],
    questions: [
      {
        type: 'single_choice',
        prompt: 'Capital of Japan?',
        correctOption: '1',
        options: [option('Kyoto'), option('Tokyo')],
      },
      {
        type: 'true_false',
        prompt: 'Ottawa is the capital of Canada.',
        correctOption: '0',
        options: [option('True'), option('False')],
      },
      {
        type: 'multi_select',
        prompt: 'Which are capitals?',
        correctOption: '',
        options: [option('Lisbon', true), option('Nairobi', true), option('Barcelona')],
      },
    ],
  }
}

function validPersonality(): QuizFormInput {
  const outcomes = [
    { key: 'cat', title: 'Cat', description: '' },
    { key: 'dog', title: 'Dog', description: 'Loyal.' },
  ]
  const question = (prompt: string) => ({
    type: 'single_choice' as const,
    prompt,
    correctOption: '',
    options: [
      { label: 'Nap', isCorrect: false, outcomeKey: 'cat', points: '1' as const },
      { label: 'Run', isCorrect: false, outcomeKey: 'dog', points: '3' as const },
    ],
  })
  return {
    kind: 'personality',
    title: 'Which pet?',
    description: '',
    hasSuggestedTime: 'yes',
    suggestedMinutes: '5',
    outcomes,
    questions: [question('Q1'), question('Q2'), question('Q3')],
  }
}

function option(label: string, isCorrect = false) {
  return { label, isCorrect, outcomeKey: '', points: '1' as const }
}

// The messages for each failing field, keyed by path.
function errors(values: QuizFormInput) {
  const result = quizFormSchema.safeParse(values)
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('quizFormSchema', () => {
  it('accepts a valid trivia quiz and a valid personality quiz', () => {
    expect(errors(validTrivia())).toEqual({})
    expect(errors(validPersonality())).toEqual({})
  })

  it('trims text before checking and saving it', () => {
    const values = validTrivia()
    values.title = '   World Capitals   '
    const result = quizFormSchema.parse(values)
    expect(result.title).toBe('World Capitals')
  })

  it('checks the title length after trimming, counting emoji as 1 character', () => {
    expect(errors({ ...validTrivia(), title: '  ab  ' }).title).toBe(
      'Enter a title of at least 3 characters.',
    )
    expect(errors({ ...validTrivia(), title: '🎉🎉🎉' }).title).toBeUndefined()
    expect(errors({ ...validTrivia(), title: 'x'.repeat(76) }).title).toBe(
      'Titles can be up to 75 characters.',
    )
  })

  it('limits the description to 250 characters', () => {
    expect(errors({ ...validTrivia(), description: 'x'.repeat(251) }).description).toBe(
      'Descriptions can be up to 250 characters.',
    )
  })

  it('needs 3 to 50 questions', () => {
    const tooFew = validTrivia()
    tooFew.questions = tooFew.questions.slice(0, 2)
    expect(errors(tooFew)['questions.root']).toBe('This quiz needs at least 3 questions.')

    const tooMany = validTrivia()
    tooMany.questions = Array.from({ length: 51 }, () => validTrivia().questions[0])
    expect(errors(tooMany)['questions.root']).toBe('A quiz can have up to 50 questions.')
  })

  it('limits question and answer text', () => {
    const values = validTrivia()
    values.questions[0].prompt = '   '
    values.questions[0].options[0].label = 'x'.repeat(151)
    values.questions[1].prompt = 'x'.repeat(301)
    expect(errors(values)).toMatchObject({
      'questions.0.prompt': 'Enter the question.',
      'questions.0.options.0.label': 'Answers can be up to 150 characters.',
      'questions.1.prompt': 'Questions can be up to 300 characters.',
    })
  })

  it('needs 2 to 8 answers per question', () => {
    const values = validTrivia()
    values.questions[0].options = [option('Only one')]
    values.questions[2].options = Array.from({ length: 9 }, (_, i) => option(`A${i}`, i === 0))
    expect(errors(values)).toMatchObject({
      'questions.0.options': 'A question needs at least 2 answers.',
      'questions.2.options': 'A question can have up to 8 answers.',
    })
  })

  it('needs exactly 1 correct answer for single-choice and true/false', () => {
    const values = validTrivia()
    values.questions[0].correctOption = ''
    values.questions[1].correctOption = '5'
    expect(errors(values)).toMatchObject({
      'questions.0.correctOption': 'Mark the correct answer.',
      'questions.1.correctOption': 'Mark the correct answer.',
    })
  })

  it('needs True and False as the true/false answers', () => {
    const values = validTrivia()
    values.questions[1].options = [option('Yes'), option('No')]
    expect(errors(values)['questions.1.options.root']).toBe(
      'True/false answers must be True and False.',
    )
  })

  it('needs at least 1 correct and 1 incorrect answer for multi-select', () => {
    const allCorrect = validTrivia()
    allCorrect.questions[2].options = [option('A', true), option('B', true)]
    expect(errors(allCorrect)['questions.2.correctOption']).toBe(
      'Mark at least 1 correct and 1 incorrect answer.',
    )

    const noneCorrect = validTrivia()
    noneCorrect.questions[2].options = [option('A'), option('B')]
    expect(errors(noneCorrect)['questions.2.correctOption']).toBe(
      'Mark at least 1 correct and 1 incorrect answer.',
    )
  })

  it('needs 2 to 30 outcomes for a personality quiz', () => {
    const tooFew = validPersonality()
    tooFew.outcomes = tooFew.outcomes.slice(0, 1)
    expect(errors(tooFew)['outcomes.root']).toBe('A personality quiz needs at least 2 outcomes.')

    const tooMany = validPersonality()
    tooMany.outcomes = Array.from({ length: 31 }, (_, i) => ({
      key: `k${i}`,
      title: `Outcome ${i}`,
      description: '',
    }))
    expect(errors(tooMany)['outcomes.root']).toBe('A personality quiz can have up to 30 outcomes.')
  })

  it('limits outcome names and descriptions', () => {
    const values = validPersonality()
    values.outcomes[0].title = ''
    values.outcomes[1].description = 'x'.repeat(501)
    expect(errors(values)).toMatchObject({
      'outcomes.0.title': 'Enter a name for this outcome.',
      'outcomes.1.description': 'Outcome descriptions can be up to 500 characters.',
    })
  })

  it('needs every personality answer to lead to an outcome, and every outcome to be reachable', () => {
    const values = validPersonality()
    values.outcomes.push({ key: 'fish', title: 'Fish', description: '' })
    values.questions[0].options[0].outcomeKey = ''
    expect(errors(values)).toMatchObject({
      'questions.0.options.0.outcomeKey': 'Choose an outcome.',
      'outcomes.2.key': 'No answer leads to this outcome yet.',
    })
  })

  it('keeps personality questions single-choice', () => {
    const values = validPersonality()
    values.questions[0].type = 'multi_select'
    expect(errors(values)['questions.0.type']).toBe('Personality questions are single-choice.')
  })

  it('accepts points of 1, 2 or 3 only', () => {
    const values = validPersonality()
    // @ts-expect-error: checking that an out-of-range value from outside the form is rejected
    values.questions[0].options[0].points = '4'
    expect(errors(values)['questions.0.options.0.points']).toBeDefined()
  })

  it('checks the suggested time only when it is turned on', () => {
    expect(errors({ ...validTrivia(), hasSuggestedTime: 'no', suggestedMinutes: 'abc' })).toEqual(
      {},
    )
    for (const minutes of ['', '0', '181', '2.5']) {
      expect(
        errors({ ...validTrivia(), hasSuggestedTime: 'yes', suggestedMinutes: minutes }),
      ).toEqual({
        suggestedMinutes: 'Enter a whole number of minutes from 1 to 180.',
      })
    }
    expect(errors({ ...validTrivia(), hasSuggestedTime: 'yes', suggestedMinutes: '180' })).toEqual(
      {},
    )
  })

  it('starts a new quiz with one empty question', () => {
    expect(emptyQuizValues().questions).toEqual([emptyQuestion()])
  })
})

describe('toSavePayload and fromSavedQuiz', () => {
  it('builds the save_quiz payload for trivia, marking correct answers per answer', () => {
    const payload = toSavePayload(quizFormSchema.parse(validTrivia()), null)
    expect(payload.id).toBeNull()
    expect(payload).not.toHaveProperty('expected_version')
    expect(payload.outcomes).toEqual([])
    expect(payload.questions[0].options).toEqual([
      { label: 'Kyoto', is_correct: false },
      { label: 'Tokyo', is_correct: true },
    ])
    expect(payload.questions[2].options.map((o) => 'is_correct' in o && o.is_correct)).toEqual([
      true,
      true,
      false,
    ])
  })

  it('builds the payload for personality, with outcome keys, points and minutes as seconds', () => {
    const payload = toSavePayload(quizFormSchema.parse(validPersonality()), {
      id: '6a1f3a52-0000-4000-8000-000000000001',
      expectedVersion: 3,
    })
    expect(payload.expected_version).toBe(3)
    expect(payload.suggested_time_seconds).toBe(300)
    expect(payload.questions[0].options[1]).toEqual({ label: 'Run', outcome_key: 'dog', points: 3 })
  })

  it('turns a saved quiz back into the same form values', () => {
    const saved: SavedQuiz = {
      ...toSavePayload(quizFormSchema.parse(validTrivia()), null),
      id: '6a1f3a52-0000-4000-8000-000000000001',
      version: 2,
    }
    expect(fromSavedQuiz(saved)).toEqual(quizFormSchema.parse(validTrivia()))
  })
})
