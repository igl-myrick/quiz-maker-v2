import { z } from 'zod'

export const emailFormSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: 'Enter a valid email address, like name@example.com.' })),
})

export type EmailFormValues = z.infer<typeof emailFormSchema>

// Supabase's default code length is 6 digits. Spaces from pasting are removed.
export const codeFormSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, { error: 'Enter the 6-digit code from your email.' })),
})

export type CodeFormInput = z.input<typeof codeFormSchema>
export type CodeFormValues = z.output<typeof codeFormSchema>
