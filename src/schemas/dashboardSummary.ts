import { z } from 'zod'

// What get_my_dashboard_summary returns: three figures for the logged-in member only.
export const dashboardSummarySchema = z.object({
  results_saved: z.number().int(),
  quizzes_made: z.number().int(),
  // 0 to 1, or null when the member has no trivia results.
  average_trivia_score: z.number().nullable(),
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
