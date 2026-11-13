import type { Session } from '@supabase/supabase-js'
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '../lib/queryClient'

type AuthListener = (event: string, session: Session | null) => void

const mocks = vi.hoisted(() => ({ listener: null as AuthListener | null }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: AuthListener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))

// Importing the store sets up its one auth subscription.
await import('./authStore')

const session = { access_token: 'token', user: { id: 'u1' } } as unknown as Session

function fireAuthEvent(event: string, next: Session | null) {
  act(() => mocks.listener?.(event, next))
}

describe('authStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    queryClient.clear()
    queryClient.setQueryData(['me', 'results'], { pages: [] })
    queryClient.setQueryData(['quizzes', 'search', ''], { pages: [] })
  })

  it('removes cached member data on logging out, leaving public data', () => {
    fireAuthEvent('SIGNED_OUT', null)
    act(() => vi.advanceTimersByTime(1))

    expect(queryClient.getQueryData(['me', 'results'])).toBeUndefined()
    expect(queryClient.getQueryData(['quizzes', 'search', ''])).toBeDefined()
    vi.useRealTimers()
  })

  it('refreshes member data on logging in, rather than removing it', () => {
    fireAuthEvent('SIGNED_IN', session)
    act(() => vi.advanceTimersByTime(1))

    expect(queryClient.getQueryState(['me', 'results'])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryData(['me', 'results'])).toBeDefined()
    vi.useRealTimers()
  })
})
