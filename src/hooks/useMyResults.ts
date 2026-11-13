import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ListCursor } from '../schemas/myQuizzes'
import { myResultsPageSchema } from '../schemas/myResults'
import { useSession } from '../stores/authStore'

export const MY_LIST_PAGE_SIZE = 20

// The member's saved results, newest first. Only runs with a session.
export function useMyResults() {
  const session = useSession()

  return useInfiniteQuery({
    queryKey: ['me', 'results'],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_my_results', {
        p_cursor: pageParam ?? undefined,
        p_limit: MY_LIST_PAGE_SIZE,
      })
      if (error) throw error
      return myResultsPageSchema.parse(data)
    },
    initialPageParam: null as ListCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: session !== null,
  })
}
