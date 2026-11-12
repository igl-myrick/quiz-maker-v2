import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { SaveQuizPayload } from '../schemas/quiz'

// save_quiz raises errors with a stable code (such as 'duplicate_title') and a detail.
export class SaveQuizError extends Error {
  code: string
  detail: string

  constructor(code: string, detail: string) {
    super(code)
    this.code = code
    this.detail = detail
  }
}

const saveResultSchema = z.object({ id: z.uuid(), version: z.number() })

export function useSaveQuiz() {
  return useMutation({
    mutationFn: async (payload: SaveQuizPayload) => {
      const { data, error } = await supabase.rpc('save_quiz', { p_quiz: payload })
      if (error) throw new SaveQuizError(error.message, error.details ?? '')
      return saveResultSchema.parse(data)
    },
  })
}
