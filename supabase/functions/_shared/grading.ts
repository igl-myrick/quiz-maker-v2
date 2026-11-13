// Grading for submit-quiz (CLAUDE.md section 1, ARCHITECTURE_SPEC.md section 5).
// Pure TypeScript with no imports, so both the Deno edge function and Vitest can use it.

export type QuestionType = 'single_choice' | 'true_false' | 'multi_select'

// A quiz with its answer key, in the snapshot shape (quiz_snapshot() or a retired copy).
export type QuizSnapshot = {
  snapshot_version: 1
  quiz: {
    id: string
    title: string
    description: string
    kind: 'trivia' | 'personality'
    version: number
    suggested_time_seconds: number | null
  }
  outcomes: { id: string; title: string; description: string }[]
  questions: {
    id: string
    position: number
    type: QuestionType
    prompt: string
    // Trivia options have is_correct. Personality options have outcome_id and points.
    options: {
      id: string
      label: string
      is_correct?: boolean
      outcome_id?: string
      points?: number
    }[]
  }[]
}

// The taker's answers: question ID to the option IDs they chose.
export type Answers = Record<string, string[]>

export type AnswerProblem =
  { code: 'unanswered'; question_ids: string[] } | { code: 'invalid_answers' }

export type RankedOutcome = { outcome_id: string; points: number }

// A question as stored on a result: with the taker's choices and, for trivia, its score.
export type GradedQuestion = QuizSnapshot['questions'][number] & {
  selected_option_ids: string[]
  score?: number
}

export type GradedQuiz = {
  // Trivia only: the mean question score, 0 to 1.
  score: number | null
  // Personality only: every outcome by points, highest first, ties already shuffled.
  outcome_ranking: RankedOutcome[] | null
  // The result snapshot: the quiz as taken, with the taker's choices and per-question scores.
  snapshot: Omit<QuizSnapshot, 'questions'> & { questions: GradedQuestion[] }
}

// Scores are stored as numeric(5,4), so keep 4 decimal places.
function round4(value: number) {
  return Math.round(value * 10000) / 10000
}

// Checks the answers fit the quiz before grading. Unknown questions or options, the same
// option twice, or several choices on a single-answer question are invalid. Every
// question must have at least one choice.
export function checkAnswers(quiz: QuizSnapshot, answers: Answers): AnswerProblem | null {
  const questionIds = new Set(quiz.questions.map((question) => question.id))
  if (Object.keys(answers).some((id) => !questionIds.has(id))) return { code: 'invalid_answers' }

  const unanswered: string[] = []
  for (const question of quiz.questions) {
    const chosen = answers[question.id] ?? []
    if (chosen.length === 0) {
      unanswered.push(question.id)
      continue
    }
    const optionIds = new Set(question.options.map((option) => option.id))
    if (chosen.some((id) => !optionIds.has(id)) || new Set(chosen).size !== chosen.length) {
      return { code: 'invalid_answers' }
    }
    if (question.type !== 'multi_select' && chosen.length > 1) return { code: 'invalid_answers' }
  }
  return unanswered.length > 0 ? { code: 'unanswered', question_ids: unanswered } : null
}

// One trivia question's score, 0 to 1.
// Single-choice and true/false: 1 if the correct option is chosen, else 0.
// Multi-select: max(0, (correct chosen - wrong chosen) / number of correct options).
export function scoreQuestion(question: QuizSnapshot['questions'][number], chosen: string[]) {
  const correctIds = question.options
    .filter((option) => option.is_correct)
    .map((option) => option.id)
  const correctChosen = chosen.filter((id) => correctIds.includes(id)).length
  const wrongChosen = chosen.length - correctChosen

  if (question.type !== 'multi_select') return correctChosen === 1 && wrongChosen === 0 ? 1 : 0
  if (correctIds.length === 0) return 0
  return Math.max(0, (correctChosen - wrongChosen) / correctIds.length)
}

// Orders outcomes by points, highest first. Each group of tied outcomes is shuffled
// (Fisher-Yates) using `random`, which returns a number in [0, 1). Untied order is fixed.
export function rankOutcomes(points: Map<string, number>, random: () => number): RankedOutcome[] {
  const byPoints = new Map<number, string[]>()
  for (const [outcomeId, total] of points) {
    byPoints.set(total, [...(byPoints.get(total) ?? []), outcomeId])
  }

  const ranking: RankedOutcome[] = []
  for (const total of [...byPoints.keys()].sort((a, b) => b - a)) {
    const group = [...(byPoints.get(total) ?? [])]
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[group[i], group[j]] = [group[j], group[i]]
    }
    ranking.push(...group.map((outcome_id) => ({ outcome_id, points: total })))
  }
  return ranking
}

// Grades checked answers. Call checkAnswers first.
export function gradeQuiz(quiz: QuizSnapshot, answers: Answers, random: () => number): GradedQuiz {
  const questions = quiz.questions.map((question) => {
    const selected_option_ids = answers[question.id] ?? []
    return quiz.quiz.kind === 'trivia'
      ? {
          ...question,
          selected_option_ids,
          score: round4(scoreQuestion(question, selected_option_ids)),
        }
      : { ...question, selected_option_ids }
  })
  const snapshot = { ...quiz, questions }

  if (quiz.quiz.kind === 'trivia') {
    const total = questions.reduce(
      (sum, question) => sum + scoreQuestion(question, question.selected_option_ids),
      0,
    )
    return { score: round4(total / questions.length), outcome_ranking: null, snapshot }
  }

  // Personality: every outcome starts at 0, so all of them appear in the ranking.
  const points = new Map(quiz.outcomes.map((outcome) => [outcome.id, 0]))
  for (const question of questions) {
    for (const option of question.options) {
      if (option.outcome_id && question.selected_option_ids.includes(option.id)) {
        points.set(option.outcome_id, (points.get(option.outcome_id) ?? 0) + (option.points ?? 0))
      }
    }
  }
  return { score: null, outcome_ranking: rankOutcomes(points, random), snapshot }
}
