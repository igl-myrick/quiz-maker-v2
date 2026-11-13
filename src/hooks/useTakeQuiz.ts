import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { takeQuizSchema } from '../schemas/submission'
import { useTakeStore } from '../stores/takeStore'

// Loads a quiz's public content in one request: the quiz, its questions and their options.
// Answer keys are never selected (and clients can't read them anyway).
async function fetchTakeQuiz(quizId: string) {
  const { data, error } = await supabase
    .from('quizzes_public')
    .select(
      'id, kind, title, version, suggested_time_seconds, questions(id, position, type, prompt, options(id, position, label))',
    )
    .eq('id', quizId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This quiz no longer exists.')
  return takeQuizSchema.parse(data)
}

// Starts a take: load the quiz, store a new take (dropping any for older versions),
// and go to the first page. Used by the Start button.
export function useStartTake() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ quizId }: { quizId: string; timed: boolean }) => fetchTakeQuiz(quizId),
    onSuccess: (quiz, { timed }) => {
      const store = useTakeStore.getState()
      store.removeOtherVersions(quiz.id, quiz.version)
      store.start(quiz, timed)
      void navigate({
        to: '/quizzes/$quizId/take',
        params: { quizId: quiz.id },
        search: { page: 1 },
      })
    },
  })
}
