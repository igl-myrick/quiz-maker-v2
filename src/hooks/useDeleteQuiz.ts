import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { MyQuizzesPage } from '../schemas/myQuizzes'
import { quizDraftKey, removeQuizDraft } from './useQuizDraft'

// Deletes through the RLS delete policy. An empty result means nothing was deleted.
// Only the cache is handled here. Closing dialogs, focus and announcements are the
// caller's job (the dashboard's My quizzes section).
export function useDeleteQuiz() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { data, error } = await supabase.from('quizzes').delete().eq('id', quizId).select('id')
      if (error) throw error
      if (data.length === 0) throw new Error('Nothing was deleted')
      return quizId
    },
    onSuccess: (quizId) => {
      removeQuizDraft(quizDraftKey(quizId))
      // Take the card off the dashboard straight away, so it can't be pressed twice.
      queryClient.setQueryData<InfiniteData<MyQuizzesPage>>(['me', 'quizzes'], (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((quiz) => quiz.id !== quizId),
              })),
            }
          : data,
      )
      // ['me'] also refreshes My results, whose rows for this quiz become "Quiz deleted".
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['quizzes'] })
      queryClient.removeQueries({ queryKey: ['quiz', quizId] })
    },
  })
}
