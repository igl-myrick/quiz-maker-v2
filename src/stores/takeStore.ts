import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { TakeQuiz } from '../schemas/submission'

// One quiz in progress. Answers live only here, keyed by question ID to the chosen
// option IDs, and only leave the browser as the submission body.
export type Take = {
  // The quiz's public content as it was when the take started, version included.
  quiz: TakeQuiz
  timed: boolean
  // When the timer started (milliseconds), or null for an untimed take.
  startedAt: number | null
  answers: Record<string, string[]>
}

type TakeState = {
  // Keyed by "<quizId>:<version>".
  takes: Record<string, Take>
  start: (quiz: TakeQuiz, timed: boolean) => void
  setAnswer: (key: string, questionId: string, optionIds: string[]) => void
  clear: (key: string) => void
  removeOtherVersions: (quizId: string, version: number) => void
}

export function takeKey(quizId: string, version: number) {
  return `${quizId}:${version}`
}

// Session storage: progress survives a reload, but is gone when the tab closes
// (CLAUDE.md section 1, "Progress during a take").
export const useTakeStore = create<TakeState>()(
  persist(
    (set) => ({
      takes: {},
      start: (quiz, timed) =>
        set((state) => ({
          takes: {
            ...state.takes,
            [takeKey(quiz.id, quiz.version)]: {
              quiz,
              timed,
              startedAt: timed ? Date.now() : null,
              answers: {},
            },
          },
        })),
      setAnswer: (key, questionId, optionIds) =>
        set((state) => {
          const take = state.takes[key]
          if (!take) return state
          return {
            takes: {
              ...state.takes,
              [key]: { ...take, answers: { ...take.answers, [questionId]: optionIds } },
            },
          }
        }),
      clear: (key) =>
        set((state) => ({
          takes: Object.fromEntries(Object.entries(state.takes).filter(([k]) => k !== key)),
        })),
      removeOtherVersions: (quizId, version) =>
        set((state) => ({
          takes: Object.fromEntries(
            Object.entries(state.takes).filter(
              ([, take]) => take.quiz.id !== quizId || take.quiz.version === version,
            ),
          ),
        })),
    }),
    {
      name: 'quiz-takes',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ takes: state.takes }),
    },
  ),
)

// The take in progress for a quiz, whichever version it started on.
export function useTakeForQuiz(quizId: string) {
  return useTakeStore((state) => Object.values(state.takes).find((take) => take.quiz.id === quizId))
}

// Questions not answered yet (a multi-select question needs at least one choice).
export function unansweredIds(take: Take, questionIds: string[]) {
  return questionIds.filter((id) => (take.answers[id]?.length ?? 0) === 0)
}
