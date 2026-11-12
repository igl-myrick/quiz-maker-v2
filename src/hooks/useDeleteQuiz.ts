import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { announce } from '../stores/announcerStore'
import { quizDraftKey, removeQuizDraft } from './useQuizDraft'

// Deletes through the RLS delete policy. An empty result means nothing was deleted.
export function useDeleteQuiz() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { data, error } = await supabase.from('quizzes').delete().eq('id', quizId).select('id')
      if (error) throw error
      if (data.length === 0) throw new Error('Nothing was deleted')
      return quizId
    },
    onSuccess: (quizId) => {
      removeQuizDraft(quizDraftKey(quizId))
      void queryClient.invalidateQueries({ queryKey: ['me', 'quizzes'] })
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      // Announce once the search page is showing, so its own page-change announcement
      // doesn't replace this one.
      void navigate({ to: '/search' }).then(() => setTimeout(() => announce('Quiz deleted'), 0))
    },
  })
}
