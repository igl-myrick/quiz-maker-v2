import { z } from 'zod'
import { quizSummarySchema } from './searchResult'

// The dashboard's list cursor: only ever passed back to the function that made it.
export const listCursorSchema = z.object({ created_at: z.string(), id: z.string() })

export type ListCursor = z.infer<typeof listCursorSchema>

// What list_my_quizzes returns. Items are the same as search items, so cards are reused.
export const myQuizzesPageSchema = z.object({
  items: z.array(quizSummarySchema),
  next_cursor: listCursorSchema.nullable(),
})

export type MyQuizzesPage = z.infer<typeof myQuizzesPageSchema>
