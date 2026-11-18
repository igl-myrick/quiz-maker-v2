import type { FieldErrors } from 'react-hook-form'
import type { SummaryItem } from '../../hooks/usePagedForm'
import type { EditorPart, QuizFormInput } from '../../schemas/quiz'
import { fieldDomId } from './FieldError'
import { ADD_OUTCOME_ID } from './OutcomesPart'
import { ADD_QUESTION_ID } from './QuestionsPart'

// Every message in React Hook Form's nested errors, with its dotted path.
function collectMessages(
  node: unknown,
  path: string[],
  out: { path: string[]; message: string }[],
) {
  if (typeof node !== 'object' || node === null) return
  if (
    'message' in node &&
    typeof node.message === 'string' &&
    node.message !== '' &&
    'type' in node
  ) {
    out.push({ path, message: node.message })
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === 'ref' || key === 'message' || key === 'type' || key === 'types') continue
    collectMessages(child, [...path, key], out)
  }
}

// Turns one error path into its summary text, part and focus target. This is the one
// place that knows which part holds each field.
function describe(path: string[], message: string): SummaryItem<EditorPart> {
  const key = path.join('.')
  const [section, first, second, third, fourth] = path

  if (section === 'title' || section === 'description') {
    const label = section === 'title' ? 'Title' : 'Description'
    return { key, text: `${label}: ${message}`, step: 'basics', targetId: fieldDomId(section) }
  }
  if (section === 'suggestedMinutes') {
    return {
      key,
      text: `Suggested time: ${message}`,
      step: 'questions',
      targetId: fieldDomId(section),
    }
  }
  if (section === 'outcomes') {
    if (first === 'root' || first === undefined) {
      return { key, text: message, step: 'outcomes', targetId: ADD_OUTCOME_ID }
    }
    const n = Number(first)
    const field = second === 'description' ? 'description' : 'title'
    return {
      key,
      text: `Outcome ${n + 1}: ${message}`,
      step: 'outcomes',
      targetId: fieldDomId(`outcomes.${n}.${field}`),
    }
  }

  // Questions
  if (first === 'root' || first === undefined) {
    return { key, text: message, step: 'questions', targetId: ADD_QUESTION_ID }
  }
  const q = Number(first)
  const where = `Question ${q + 1}`
  if (second === 'options') {
    const a = Number(third)
    if (Number.isInteger(a) && fourth !== undefined) {
      const field = fourth === 'outcomeKey' ? 'outcomeKey' : 'label'
      return {
        key,
        text: `${where}, answer ${a + 1}: ${message}`,
        step: 'questions',
        targetId: fieldDomId(`questions.${q}.options.${a}.${field}`),
      }
    }
    return {
      key,
      text: `${where}: ${message}`,
      step: 'questions',
      targetId: fieldDomId(`questions.${q}.options.0.label`),
    }
  }
  const field = second === 'correctOption' || second === 'type' ? second : 'prompt'
  return {
    key,
    text: `${where}: ${message}`,
    step: 'questions',
    targetId: fieldDomId(`questions.${q}.${field}`),
  }
}

// The part that holds the field at an error path.
export function partOf(path: PropertyKey[]): EditorPart {
  return describe(path.map(String), '').step
}

export function summaryItems(errors: FieldErrors<QuizFormInput>): SummaryItem<EditorPart>[] {
  const messages: { path: string[]; message: string }[] = []
  collectMessages(errors, [], messages)
  return messages.map(({ path, message }) => describe(path, message))
}
