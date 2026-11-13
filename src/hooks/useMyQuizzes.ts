import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { myQuizzesPageSchema, type ListCursor } from '../schemas/myQuizzes'
import { useSession } from '../stores/authStore'
import { MY_LIST_PAGE_SIZE } from './useMyResults'

// The quizzes the member created, newest first. Only runs with a session.
export function useMyQuizzes() {
  const session = useSession()

  return useInfiniteQuery({
    queryKey: ['me', 'quizzes'],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_my_quizzes', {
        p_cursor: pageParam ?? undefined,
        p_limit: MY_LIST_PAGE_SIZE,
      })
      if (error) throw error
      return myQuizzesPageSchema.parse(data)
    },
    initialPageParam: null as ListCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: session !== null,
  })
}
