import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  quizDraftSchema,
  type QuizDraft,
  type QuizFormInput,
  type QuizFormValues,
} from '../schemas/quiz'
import { announce } from '../stores/announcerStore'

// Drafts live in session storage, so they survive a reload but not closing the tab.
export function quizDraftKey(quizId: string | null) {
  return quizId ? `quiz-draft:${quizId}` : 'quiz-draft:new'
}

// Read once, when the form starts. Anything unreadable or the wrong shape is ignored.
export function readQuizDraft(key: string): QuizDraft | null {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return null
    const result = quizDraftSchema.safeParse(JSON.parse(stored))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function removeQuizDraft(key: string) {
  sessionStorage.removeItem(key)
}

// The one effect for drafts: subscribe to form changes and write each one to session
// storage, unsubscribing on cleanup. It also announces a restored draft once on start.
export function useQuizDraftWriter(
  form: UseFormReturn<QuizFormInput, unknown, QuizFormValues>,
  key: string,
  baseVersion: number | null,
  restored: boolean,
) {
  useEffect(() => {
    if (restored) announce('Restored your unsaved draft.')

    const subscription = form.watch((values) => {
      sessionStorage.setItem(key, JSON.stringify({ baseVersion, values }))
    })
    return () => subscription.unsubscribe()
  }, [form, key, baseVersion, restored])
}
