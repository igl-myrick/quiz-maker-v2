import { useMutation, useQueryClient } from '@tanstack/react-query'
import { removeClaimToken } from '../lib/claimTokens'
import { supabase } from '../lib/supabase'

// Saves an anonymous result to the member's account with this browser's claim token.
// Resolves true when saved, false when the result can't be saved (expired, already
// saved). Either way the token is no longer useful, so it is removed. On an error the
// token is kept, so the member can try again.
export function useClaimResult(resultId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('claim_result', {
        p_id: resultId,
        p_token: token,
      })
      if (error) throw error
      return data
    },
    onSuccess: (saved) => {
      removeClaimToken(resultId)
      void queryClient.invalidateQueries({ queryKey: ['result', resultId] })
      if (saved) void queryClient.invalidateQueries({ queryKey: ['me', 'results'] })
    },
  })
}
