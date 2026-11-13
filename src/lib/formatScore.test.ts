import { describe, expect, it } from 'vitest'
import { formatPoints } from './formatScore'

describe('formatPoints', () => {
  it('shows at most 2 decimals, without trailing zeros', () => {
    expect(formatPoints(3.5)).toBe('3.5')
    expect(formatPoints(8)).toBe('8')
    expect(formatPoints(19 / 3)).toBe('6.33')
    // A stored score of 0.6667 on 3 questions is 2.0001 points.
    expect(formatPoints(0.6667 * 3)).toBe('2')
  })
})
