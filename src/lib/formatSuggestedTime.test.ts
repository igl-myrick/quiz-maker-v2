import { describe, expect, it } from 'vitest'
import { formatSuggestedTime } from './formatSuggestedTime'

describe('formatSuggestedTime', () => {
  it('shows whole minutes', () => {
    expect(formatSuggestedTime(300)).toBe('Suggested time: 5 min')
  })

  it('rounds partial minutes up', () => {
    expect(formatSuggestedTime(61)).toBe('Suggested time: 2 min')
  })

  it('never shows less than 1 minute', () => {
    expect(formatSuggestedTime(1)).toBe('Suggested time: 1 min')
  })
})
