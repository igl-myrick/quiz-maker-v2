import { z } from 'zod'

export const MAX_QUERY_LENGTH = 200

// The router may hand over q as a number (for ?q=1234), so accept both and use the text.
const queryParam = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim().slice(0, MAX_QUERY_LENGTH))
  .optional()
  .catch(undefined)

// An invalid quiz ID is treated as missing rather than showing an error page.
const quizParam = z.uuid().optional().catch(undefined)

const searchParamsSchema = z.object({ q: queryParam, quiz: quizParam })

export type SearchParams = {
  q?: string
  quiz?: string
}

// The search route's validateSearch. The URL is the single source of truth for q and quiz.
export function parseSearchParams(raw: Record<string, unknown>): SearchParams {
  const { q, quiz } = searchParamsSchema.parse(raw)
  return {
    ...(q ? { q } : {}),
    ...(quiz ? { quiz } : {}),
  }
}

export const searchFormSchema = z.object({
  q: z.string().trim().max(MAX_QUERY_LENGTH),
})

export type SearchFormValues = z.infer<typeof searchFormSchema>
