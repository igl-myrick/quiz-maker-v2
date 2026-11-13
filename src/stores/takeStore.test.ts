import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TakeQuiz } from '../schemas/submission'
import { takeKey, unansweredIds, useTakeStore } from './takeStore'

function quiz(version: number): TakeQuiz {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    version,
    kind: 'trivia',
    title: 'Capitals',
    suggested_time_seconds: 300,
    questions: [
      { id: 'q1', position: 1, type: 'single_choice', prompt: 'One?', options: [] },
      { id: 'q2', position: 2, type: 'multi_select', prompt: 'Two?', options: [] },
    ],
  }
}

const state = () => useTakeStore.getState()

describe('takeStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useTakeStore.setState({ takes: {} })
  })

  it('starts a take with its own copy of the quiz, and a start time only when timed', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000)
    state().start(quiz(1), true)
    state().start({ ...quiz(1), id: 'other' }, false)
    vi.restoreAllMocks()

    const timed = state().takes[takeKey(quiz(1).id, 1)]
    expect(timed).toMatchObject({ timed: true, startedAt: 5_000, answers: {} })
    expect(timed.quiz.title).toBe('Capitals')
    expect(state().takes[takeKey('other', 1)].startedAt).toBeNull()
  })

  it('stores answers and saves them to session storage', () => {
    state().start(quiz(1), false)
    const key = takeKey(quiz(1).id, 1)
    state().setAnswer(key, 'q2', ['a', 'b'])

    expect(state().takes[key].answers).toEqual({ q2: ['a', 'b'] })
    const saved = JSON.parse(sessionStorage.getItem('quiz-takes') ?? '{}')
    expect(saved.state.takes[key].answers).toEqual({ q2: ['a', 'b'] })
  })

  it('removes takes for other versions of the same quiz only', () => {
    state().start(quiz(1), false)
    state().start(quiz(2), false)
    state().start({ ...quiz(1), id: 'other' }, false)

    state().removeOtherVersions(quiz(1).id, 2)

    expect(Object.keys(state().takes).sort()).toEqual(
      [takeKey(quiz(1).id, 2), takeKey('other', 1)].sort(),
    )
  })

  it('clears a take', () => {
    state().start(quiz(1), false)
    state().clear(takeKey(quiz(1).id, 1))
    expect(state().takes).toEqual({})
  })

  it('counts a question as answered once it has at least one choice', () => {
    state().start(quiz(1), false)
    const key = takeKey(quiz(1).id, 1)
    state().setAnswer(key, 'q2', [])
    expect(unansweredIds(state().takes[key], ['q1', 'q2'])).toEqual(['q1', 'q2'])
    state().setAnswer(key, 'q1', ['a'])
    expect(unansweredIds(state().takes[key], ['q1', 'q2'])).toEqual(['q2'])
  })
})
