import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { dashboardSummarySchema } from '../schemas/dashboardSummary'
import { useSession } from '../stores/authStore'

// The dashboard's summary tiles. Under ['me'], so deleting a quiz or logging out
// refreshes or clears it with the lists. Only runs with a session.
export function useDashboardSummary() {
  const session = useSession()

  return useQuery({
    queryKey: ['me', 'summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_dashboard_summary')
      if (error) throw error
      return dashboardSummarySchema.parse(data)
    },
    enabled: session !== null,
  })
}
