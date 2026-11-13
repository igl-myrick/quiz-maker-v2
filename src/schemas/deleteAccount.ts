import { z } from 'zod'

// The person types "delete" to confirm deleting their account. Spaces and capitals
// don't matter.
export function isConfirmWord(value: string) {
  return value.trim().toLowerCase() === 'delete'
}

export const deleteAccountSchema = z.object({
  confirmation: z.string().refine(isConfirmWord, 'Type the word delete to confirm.'),
})

export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>
