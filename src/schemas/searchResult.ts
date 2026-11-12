import { z } from 'zod'

// The quiz fields a card or the details popup shows. Never includes creator_id.
export const quizSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(['trivia', 'personality']),
  title: z.string(),
  description: z.string(),
  question_count: z.number(),
  suggested_time_seconds: z.number().nullable(),
})

export type QuizSummary = z.infer<typeof quizSummarySchema>

// The cursor is opaque: it is only ever passed back to search_quizzes.
const cursorSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

export type SearchCursor = z.infer<typeof cursorSchema>

// The jsonb that search_quizzes returns.
export const searchResponseSchema = z.object({
  mode: z.enum(['browse', 'search', 'no_terms']),
  total: z.number(),
  items: z.array(quizSummarySchema),
  next_cursor: cursorSchema.nullable(),
})

export type SearchResponse = z.infer<typeof searchResponseSchema>
