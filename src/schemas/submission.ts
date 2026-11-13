import { z } from 'zod'

// ---------------------------------------------------------------------------
// The quiz as a taker sees it: public content only, never answer keys.
// Captured when the take starts and kept with the take (ADR 0003).
// ---------------------------------------------------------------------------

export const takeQuizSchema = z.object({
  id: z.uuid(),
  version: z.number(),
  kind: z.enum(['trivia', 'personality']),
  title: z.string(),
  suggested_time_seconds: z.number().nullable(),
  questions: z
    .array(
      z.object({
        id: z.uuid(),
        position: z.number(),
        type: z.enum(['single_choice', 'true_false', 'multi_select']),
        prompt: z.string(),
        options: z
          .array(z.object({ id: z.uuid(), position: z.number(), label: z.string() }))
          .transform((options) => [...options].sort((a, b) => a.position - b.position)),
      }),
    )
    .transform((questions) => [...questions].sort((a, b) => a.position - b.position)),
})

export type TakeQuiz = z.infer<typeof takeQuizSchema>
export type TakeQuestion = TakeQuiz['questions'][number]

// ---------------------------------------------------------------------------
// The submit-quiz edge function
// ---------------------------------------------------------------------------

export type SubmissionBody = {
  quiz_id: string
  quiz_version: number
  answers: Record<string, string[]>
  timed: boolean
  started_at: string | null
}

export const submitSuccessSchema = z.object({
  result_id: z.uuid(),
  claim_token: z.string().optional(),
})

// The JSON body of an error response.
export const submitErrorBodySchema = z.object({
  code: z.string(),
  question_ids: z.array(z.string()).optional(),
})
