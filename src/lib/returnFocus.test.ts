import { afterEach, describe, expect, it } from 'vitest'
import { rememberReturnFocus, takeReturnFocus } from './returnFocus'

describe('returnFocus', () => {
  afterEach(() => document.body.replaceChildren())

  it('returns the recorded element once, for its own history entry only', () => {
    const link = document.createElement('a')
    link.id = 'quiz-card-1'
    document.body.append(link)

    rememberReturnFocus('entry-a', 'quiz-card-1')

    expect(takeReturnFocus('entry-b')).toBeNull()
    expect(takeReturnFocus('entry-a')).toBe(link)
    expect(takeReturnFocus('entry-a')).toBeNull()
  })

  it('returns nothing when the element is no longer on the page', () => {
    rememberReturnFocus('entry-a', 'quiz-card-gone')
    expect(takeReturnFocus('entry-a')).toBeNull()
  })

  it('ignores entries without a key', () => {
    rememberReturnFocus(undefined, 'quiz-card-1')
    expect(takeReturnFocus(undefined)).toBeNull()
  })
})
