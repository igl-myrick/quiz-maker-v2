import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  submitErrorBodySchema,
  submitSuccessSchema,
  type SubmissionBody,
} from '../schemas/submission'

// A failed submission: the HTTP status (0 for a network failure), the function's error
// code, and for "unanswered" the question IDs the server named.
export class SubmitError extends Error {
  status: number
  code: string
  questionIds: string[]

  constructor(status: number, code: string, questionIds: string[] = []) {
    super(code)
    this.status = status
    this.code = code
    this.questionIds = questionIds
  }
}

async function submitQuiz(body: SubmissionBody) {
  const { data, error } = await supabase.functions.invoke('submit-quiz', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      // A non-2xx response. Its body is JSON { code, ... }.
      const response: Response = error.context
      const parsed = submitErrorBodySchema.safeParse(await response.json().catch(() => null))
      throw new SubmitError(
        response.status,
        parsed.success ? parsed.data.code : 'unknown',
        parsed.success ? (parsed.data.question_ids ?? []) : [],
      )
    }
    // FunctionsFetchError and anything else: the request didn't get through.
    throw new SubmitError(0, 'network')
  }
  return submitSuccessSchema.parse(data)
}

export function useSubmitQuiz() {
  return useMutation({ mutationFn: submitQuiz })
}
