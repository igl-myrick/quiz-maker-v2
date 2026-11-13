import { z } from 'zod'

// What get_result returns (feature 0, criterion 16, plus feature 1's timing fields).
// Trivia snapshots include the answer key; personality snapshots don't.

const resultOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  is_correct: z.boolean().optional(),
})

const resultQuestionSchema = z.object({
  id: z.string(),
  position: z.number(),
  type: z.enum(['single_choice', 'true_false', 'multi_select']),
  prompt: z.string(),
  options: z.array(resultOptionSchema),
  selected_option_ids: z.array(z.string()),
  score: z.number().optional(),
})

const resultSchemaOk = z.object({
  status: z.literal('ok'),
  quiz_exists: z.boolean(),
  quiz_updated: z.boolean(),
  claimable: z.boolean(),
  result: z.object({
    id: z.uuid(),
    quiz_id: z.uuid().nullable(),
    quiz_version: z.number(),
    quiz_kind: z.enum(['trivia', 'personality']),
    quiz_title: z.string(),
    created_at: z.string(),
    expires_at: z.string().nullable(),
    score: z.number().nullable(),
    snapshot: z.object({
      quiz: z.object({ suggested_time_seconds: z.number().nullable() }),
      questions: z.array(resultQuestionSchema),
    }),
    winning_outcome: z
      .object({ id: z.string(), title: z.string(), description: z.string() })
      .nullable(),
    timed: z.boolean(),
    duration_seconds: z.number().nullable(),
  }),
})

export const resultResponseSchema = z.discriminatedUnion('status', [
  resultSchemaOk,
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('not_found') }),
])

export type ResultResponse = z.infer<typeof resultResponseSchema>
export type ResultOk = z.infer<typeof resultSchemaOk>
export type Result = ResultOk['result']
export type ResultQuestion = z.infer<typeof resultQuestionSchema>
