import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { resultResponseSchema } from '../schemas/result'

// One result by its exact ID, through get_result. Results never change once saved,
// except that an anonymous one expires, so they aren't refetched in the background.
export function resultQuery(resultId: string) {
  return queryOptions({
    queryKey: ['result', resultId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_result', { p_id: resultId })
      if (error) throw error
      return resultResponseSchema.parse(data)
    },
    staleTime: 60_000,
  })
}

export function useResult(resultId: string) {
  return useQuery(resultQuery(resultId))
}
