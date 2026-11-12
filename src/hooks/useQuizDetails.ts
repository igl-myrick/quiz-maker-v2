import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { quizSummarySchema } from '../schemas/searchResult'

// One quiz for the details popup, read from the public view (never creator_id).
// Resolves to null when the quiz doesn't exist.
export function useQuizDetails(quizId: string) {
  return useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes_public')
        .select('id, kind, title, description, question_count, suggested_time_seconds')
        .eq('id', quizId)
        .maybeSingle()
      if (error) throw error
      return data === null ? null : quizSummarySchema.parse(data)
    },
  })
}
