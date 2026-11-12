import { queryOptions, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { savedQuizSchema } from '../schemas/quiz'

const editResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), quiz: savedQuizSchema }),
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('forbidden') }),
])

export type QuizForEdit = z.infer<typeof editResponseSchema>

// Under ['me'], so it is refetched or removed when the member logs in or out.
export function quizForEditQuery(quizId: string) {
  return queryOptions({
    queryKey: ['me', 'quiz-edit', quizId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_quiz_for_edit', { p_id: quizId })
      if (error) throw error
      return editResponseSchema.parse(data)
    },
  })
}

export function useQuizForEdit(quizId: string, enabled: boolean) {
  return useQuery({ ...quizForEditQuery(quizId), enabled })
}
