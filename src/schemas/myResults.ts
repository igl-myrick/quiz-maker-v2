import { z } from 'zod'
import { listCursorSchema } from './myQuizzes'

// One row of list_my_results: narrow fields only, never the snapshot or account fields.
export const myResultSchema = z.object({
  id: z.uuid(),
  quiz_kind: z.enum(['trivia', 'personality']),
  quiz_title: z.string(),
  created_at: z.string(),
  // Trivia only.
  score: z.number().nullable(),
  question_count: z.number().nullable(),
  // Personality only.
  winning_outcome_title: z.string().nullable(),
  quiz_status: z.enum(['current', 'updated', 'deleted']),
})

export type MyResult = z.infer<typeof myResultSchema>

export const myResultsPageSchema = z.object({
  items: z.array(myResultSchema),
  next_cursor: listCursorSchema.nullable(),
})

export type MyResultsPage = z.infer<typeof myResultsPageSchema>
