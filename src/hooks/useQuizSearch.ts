import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { searchResponseSchema, type SearchCursor } from '../schemas/searchResult'

export const SEARCH_PAGE_SIZE = 20

// One infinite query per search. Browsing (no q) and searching use the same function.
export function useQuizSearch(q: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['quizzes', 'search', q ?? ''],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('search_quizzes', {
        p_query: q ?? '',
        p_cursor: pageParam ?? undefined,
        p_limit: SEARCH_PAGE_SIZE,
      })
      if (error) throw error
      return searchResponseSchema.parse(data)
    },
    initialPageParam: null as SearchCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  })
}
