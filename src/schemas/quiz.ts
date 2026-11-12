import { z } from 'zod'
import { QUIZ_LIMITS as L } from './quizLimits'

// ---------------------------------------------------------------------------
// The quiz editor's form values and their rules (CLAUDE.md section 1 plus the
// limits in feature 2's spec). save_quiz checks the same rules again on the server.
// ---------------------------------------------------------------------------

export const QUESTION_TYPES = ['single_choice', 'true_false', 'multi_select'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export type QuizKind = 'trivia' | 'personality'

// Lengths count characters, not UTF-16 units, so an emoji counts as 1, like char_length.
export function charCount(text: string) {
  return [...text].length
}

// A text field: trimmed first, then checked against its limits.
function text(min: number, max: number, tooShort: string, tooLong: string) {
  return z
    .string()
    .trim()
    .refine((value) => charCount(value) >= min, tooShort)
    .refine((value) => charCount(value) <= max, tooLong)
}

const optionSchema = z.object({
  label: text(
    1,
    L.answerMax,
    'Enter the answer.',
    `Answers can be up to ${L.answerMax} characters.`,
  ),
  // Multi-select only: whether this answer is correct.
  isCorrect: z.boolean(),
  // Personality only: which outcome this answer leads to, and how many points.
  outcomeKey: z.string(),
  points: z.enum(['1', '2', '3']),
})

const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: text(
    1,
    L.promptMax,
    'Enter the question.',
    `Questions can be up to ${L.promptMax} characters.`,
  ),
  // Single-choice and true/false: the index of the one correct answer, as text ('' = none yet).
  correctOption: z.string(),
  options: z
    .array(optionSchema)
    .min(L.answersMin, `A question needs at least ${L.answersMin} answers.`)
    .max(L.answersMax, `A question can have up to ${L.answersMax} answers.`),
})

const outcomeSchema = z.object({
  // A client-side reference that answers use to point at this outcome.
  key: z.string(),
  title: text(
    1,
    L.outcomeNameMax,
    'Enter a name for this outcome.',
    `Outcome names can be up to ${L.outcomeNameMax} characters.`,
  ),
  description: text(
    0,
    L.outcomeDescriptionMax,
    '',
    `Outcome descriptions can be up to ${L.outcomeDescriptionMax} characters.`,
  ),
})

const sharedFields = {
  title: text(
    L.titleMin,
    L.titleMax,
    `Enter a title of at least ${L.titleMin} characters.`,
    `Titles can be up to ${L.titleMax} characters.`,
  ),
  description: text(
    0,
    L.descriptionMax,
    '',
    `Descriptions can be up to ${L.descriptionMax} characters.`,
  ),
  hasSuggestedTime: z.enum(['no', 'yes']),
  suggestedMinutes: z.string(),
  outcomes: z.array(outcomeSchema),
  questions: z.array(questionSchema),
}

type Issue = { path: (string | number)[]; message: string }

// Rules that span several fields. Each error is attached to a field the form shows,
// so the inline message and the error summary can both find it.
function crossFieldIssues(values: z.output<typeof quizShape>): Issue[] {
  const issues: Issue[] = []
  const add = (path: (string | number)[], message: string) => issues.push({ path, message })

  if (values.questions.length < L.questionsMin) {
    add(['questions', 'root'], `This quiz needs at least ${L.questionsMin} questions.`)
  } else if (values.questions.length > L.questionsMax) {
    add(['questions', 'root'], `A quiz can have up to ${L.questionsMax} questions.`)
  }

  if (values.hasSuggestedTime === 'yes') {
    const minutes = Number(values.suggestedMinutes)
    if (
      values.suggestedMinutes.trim() === '' ||
      !Number.isInteger(minutes) ||
      minutes < L.minutesMin ||
      minutes > L.minutesMax
    ) {
      add(
        ['suggestedMinutes'],
        `Enter a whole number of minutes from ${L.minutesMin} to ${L.minutesMax}.`,
      )
    }
  }

  if (values.kind === 'personality') {
    if (values.outcomes.length < L.outcomesMin) {
      add(['outcomes', 'root'], `A personality quiz needs at least ${L.outcomesMin} outcomes.`)
    } else if (values.outcomes.length > L.outcomesMax) {
      add(['outcomes', 'root'], `A personality quiz can have up to ${L.outcomesMax} outcomes.`)
    }

    const keys = values.outcomes.map((outcome) => outcome.key)
    const used = new Set<string>()
    values.questions.forEach((question, q) => {
      if (question.type !== 'single_choice') {
        add(['questions', q, 'type'], 'Personality questions are single-choice.')
      }
      question.options.forEach((option, o) => {
        if (keys.includes(option.outcomeKey)) used.add(option.outcomeKey)
        else add(['questions', q, 'options', o, 'outcomeKey'], 'Choose an outcome.')
      })
    })
    // On the hidden key, not the name, so "Next" from the outcomes part (which only checks
    // names and descriptions) isn't blocked before any questions exist. Publish checks it.
    values.outcomes.forEach((outcome, i) => {
      if (!used.has(outcome.key))
        add(['outcomes', i, 'key'], 'No answer leads to this outcome yet.')
    })
    return issues
  }

  values.questions.forEach((question, q) => {
    const count = question.options.length
    if (question.type === 'multi_select') {
      const correct = question.options.filter((option) => option.isCorrect).length
      if (correct < 1 || correct === count) {
        add(['questions', q, 'correctOption'], 'Mark at least 1 correct and 1 incorrect answer.')
      }
    } else {
      const index = Number(question.correctOption)
      if (
        question.correctOption === '' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= count
      ) {
        add(['questions', q, 'correctOption'], 'Mark the correct answer.')
      }
    }
    if (
      question.type === 'true_false' &&
      (count !== 2 || question.options[0].label !== 'True' || question.options[1].label !== 'False')
    ) {
      add(['questions', q, 'options', 'root'], 'True/false answers must be True and False.')
    }
  })
  return issues
}

// The shape alone, without the cross-field rules. Also used to check a saved draft.
const quizShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('trivia'), ...sharedFields }),
  z.object({ kind: z.literal('personality'), ...sharedFields }),
])

export const quizFormSchema = quizShape.superRefine((values, ctx) => {
  for (const issue of crossFieldIssues(values)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  }
})

export type QuizFormInput = z.input<typeof quizFormSchema>
export type QuizFormValues = z.output<typeof quizFormSchema>
export type QuestionValues = QuizFormInput['questions'][number]
export type OptionValues = QuestionValues['options'][number]
export type OutcomeValues = QuizFormInput['outcomes'][number]

// ---------------------------------------------------------------------------
// Empty values
// ---------------------------------------------------------------------------

export function emptyOption(label = ''): OptionValues {
  return { label, isCorrect: false, outcomeKey: '', points: '1' }
}

export function emptyQuestion(): QuestionValues {
  return {
    type: 'single_choice',
    prompt: '',
    correctOption: '',
    options: [emptyOption(), emptyOption()],
  }
}

export function emptyOutcome(): OutcomeValues {
  return { key: crypto.randomUUID(), title: '', description: '' }
}

export function emptyQuizValues(): QuizFormInput {
  return {
    kind: 'trivia',
    title: '',
    description: '',
    hasSuggestedTime: 'no',
    suggestedMinutes: '',
    outcomes: [],
    questions: [emptyQuestion()],
  }
}

// ---------------------------------------------------------------------------
// Converting to and from the shape save_quiz and get_quiz_for_edit use
// ---------------------------------------------------------------------------

const savedOptionSchema = z.union([
  z.object({ label: z.string(), is_correct: z.boolean() }),
  z.object({ label: z.string(), outcome_key: z.string(), points: z.number() }),
])

export const savedQuizSchema = z.object({
  id: z.uuid(),
  version: z.number(),
  kind: z.enum(['trivia', 'personality']),
  title: z.string(),
  description: z.string(),
  suggested_time_seconds: z.number().nullable(),
  outcomes: z.array(z.object({ key: z.string(), title: z.string(), description: z.string() })),
  questions: z.array(
    z.object({
      type: z.enum(QUESTION_TYPES),
      prompt: z.string(),
      options: z.array(savedOptionSchema),
    }),
  ),
})

export type SavedQuiz = z.infer<typeof savedQuizSchema>

export function fromSavedQuiz(quiz: SavedQuiz): QuizFormInput {
  return {
    kind: quiz.kind,
    title: quiz.title,
    description: quiz.description,
    hasSuggestedTime: quiz.suggested_time_seconds === null ? 'no' : 'yes',
    suggestedMinutes:
      quiz.suggested_time_seconds === null ? '' : String(quiz.suggested_time_seconds / 60),
    outcomes: quiz.outcomes,
    questions: quiz.questions.map((question) => {
      const correctIndex = question.options.findIndex(
        (option) => 'is_correct' in option && option.is_correct,
      )
      return {
        type: question.type,
        prompt: question.prompt,
        correctOption:
          question.type !== 'multi_select' && correctIndex >= 0 ? String(correctIndex) : '',
        options: question.options.map((option) =>
          'is_correct' in option
            ? {
                ...emptyOption(option.label),
                // Single-choice and true/false use correctOption instead.
                isCorrect: question.type === 'multi_select' && option.is_correct,
              }
            : {
                ...emptyOption(option.label),
                outcomeKey: option.outcome_key,
                points: String(option.points) as OptionValues['points'],
              },
        ),
      }
    }),
  }
}

export type SaveQuizPayload = {
  id: string | null
  expected_version?: number
  kind: QuizKind
  title: string
  description: string
  suggested_time_seconds: number | null
  outcomes: { key: string; title: string; description: string }[]
  questions: {
    type: QuestionType
    prompt: string
    options: (
      | { label: string; is_correct: boolean }
      | { label: string; outcome_key: string; points: number }
    )[]
  }[]
}

export function toSavePayload(
  values: QuizFormValues,
  edit: { id: string; expectedVersion: number } | null,
): SaveQuizPayload {
  return {
    id: edit?.id ?? null,
    ...(edit ? { expected_version: edit.expectedVersion } : {}),
    kind: values.kind,
    title: values.title,
    description: values.description,
    suggested_time_seconds:
      values.hasSuggestedTime === 'yes' ? Number(values.suggestedMinutes) * 60 : null,
    outcomes: values.kind === 'personality' ? values.outcomes : [],
    questions: values.questions.map((question) => ({
      type: question.type,
      prompt: question.prompt,
      options: question.options.map((option, index) => {
        if (values.kind === 'personality') {
          return {
            label: option.label,
            outcome_key: option.outcomeKey,
            points: Number(option.points),
          }
        }
        const isCorrect =
          question.type === 'multi_select'
            ? option.isCorrect
            : question.correctOption === String(index)
        return { label: option.label, is_correct: isCorrect }
      }),
    })),
  }
}

// ---------------------------------------------------------------------------
// The editor's current part, kept in the URL as ?part=
// ---------------------------------------------------------------------------

export const EDITOR_PARTS = ['basics', 'outcomes', 'questions'] as const
export type EditorPart = (typeof EDITOR_PARTS)[number]

const editorSearchSchema = z.object({ part: z.enum(EDITOR_PARTS).optional().catch(undefined) })

export function parseEditorSearch(raw: Record<string, unknown>): { part?: EditorPart } {
  const { part } = editorSearchSchema.parse(raw)
  return part ? { part } : {}
}

// ---------------------------------------------------------------------------
// Drafts saved in session storage
// ---------------------------------------------------------------------------

// A draft is checked for the right shape only, with no rules, because an unfinished quiz
// breaks them (an empty answer, say). Text is kept exactly as typed.
const draftValuesSchema = z.object({
  kind: z.enum(['trivia', 'personality']),
  title: z.string(),
  description: z.string(),
  hasSuggestedTime: z.enum(['no', 'yes']),
  suggestedMinutes: z.string(),
  outcomes: z.array(z.object({ key: z.string(), title: z.string(), description: z.string() })),
  questions: z.array(
    z.object({
      type: z.enum(QUESTION_TYPES),
      prompt: z.string(),
      correctOption: z.string(),
      options: z.array(
        z.object({
          label: z.string(),
          isCorrect: z.boolean(),
          outcomeKey: z.string(),
          points: z.enum(['1', '2', '3']),
        }),
      ),
    }),
  ),
})

export const quizDraftSchema = z.object({
  // The quiz version the draft started from (null for a new quiz).
  baseVersion: z.number().nullable(),
  values: draftValuesSchema,
})

export type QuizDraft = { baseVersion: number | null; values: QuizFormInput }
