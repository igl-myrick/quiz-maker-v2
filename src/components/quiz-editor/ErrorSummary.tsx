import { useId, type ReactNode, type RefObject } from 'react'
import type { FieldErrors } from 'react-hook-form'
import type { EditorPart, QuizFormInput } from '../../schemas/quiz'
import { fieldDomId } from './FieldError'
import { ADD_OUTCOME_ID } from './OutcomesPart'
import { ADD_QUESTION_ID } from './QuestionsPart'

export type SummaryItem = {
  key: string
  text: string
  // Where the problem is: the part to show and the element to focus.
  part: EditorPart
  targetId: string
}

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

// Turns one error path into its summary text, part and focus target.
function describe(path: string[], message: string): SummaryItem {
  const key = path.join('.')
  const [section, first, second, third, fourth] = path

  if (section === 'title' || section === 'description') {
    const label = section === 'title' ? 'Title' : 'Description'
    return { key, text: `${label}: ${message}`, part: 'basics', targetId: fieldDomId(section) }
  }
  if (section === 'suggestedMinutes') {
    return {
      key,
      text: `Suggested time: ${message}`,
      part: 'questions',
      targetId: fieldDomId(section),
    }
  }
  if (section === 'outcomes') {
    if (first === 'root' || first === undefined) {
      return { key, text: message, part: 'outcomes', targetId: ADD_OUTCOME_ID }
    }
    const n = Number(first)
    const field = second === 'description' ? 'description' : 'title'
    return {
      key,
      text: `Outcome ${n + 1}: ${message}`,
      part: 'outcomes',
      targetId: fieldDomId(`outcomes.${n}.${field}`),
    }
  }

  // Questions
  if (first === 'root' || first === undefined) {
    return { key, text: message, part: 'questions', targetId: ADD_QUESTION_ID }
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
        part: 'questions',
        targetId: fieldDomId(`questions.${q}.options.${a}.${field}`),
      }
    }
    return {
      key,
      text: `${where}: ${message}`,
      part: 'questions',
      targetId: fieldDomId(`questions.${q}.options.0.label`),
    }
  }
  const field = second === 'correctOption' || second === 'type' ? second : 'prompt'
  return {
    key,
    text: `${where}: ${message}`,
    part: 'questions',
    targetId: fieldDomId(`questions.${q}.${field}`),
  }
}

export function summaryItems(errors: FieldErrors<QuizFormInput>): SummaryItem[] {
  const messages: { path: string[]; message: string }[] = []
  collectMessages(errors, [], messages)
  return messages.map(({ path, message }) => describe(path, message))
}

type ErrorSummaryProps = {
  summaryRef: RefObject<HTMLDivElement | null>
  items: SummaryItem[]
  serverMessage: ReactNode
  onSelect: (item: SummaryItem) => void
}

// Shown at the top of the current part after Next or Publish finds problems.
export function ErrorSummary({ summaryRef, items, serverMessage, onSelect }: ErrorSummaryProps) {
  const headingId = useId()

  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      className="border padding margin-bottom"
    >
      <h3 id={headingId} className="error">
        Fix these before publishing
      </h3>
      <ul>
        {serverMessage && <li>{serverMessage}</li>}
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={`#${item.targetId}`}
              onClick={(event) => {
                event.preventDefault()
                onSelect(item)
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
