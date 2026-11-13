import { beforeEach, describe, expect, it } from 'vitest'
import { pruneClaimTokens, readClaimToken, removeClaimToken, saveClaimToken } from './claimTokens'

const DAY = 24 * 60 * 60 * 1000

describe('claimTokens', () => {
  beforeEach(() => localStorage.clear())

  it('stores a token for a day under claim:<resultId>', () => {
    saveClaimToken('r1', 'secret-token', 1_000)
    expect(JSON.parse(localStorage.getItem('claim:r1') ?? '')).toEqual({
      token: 'secret-token',
      expiresAt: 1_000 + DAY,
    })
    expect(readClaimToken('r1', 2_000)).toBe('secret-token')
  })

  it('treats an expired, missing or damaged token as absent', () => {
    saveClaimToken('r1', 'old', 0)
    localStorage.setItem('claim:r2', 'not json')
    expect(readClaimToken('r1', DAY + 1)).toBeNull()
    expect(readClaimToken('r2')).toBeNull()
    expect(readClaimToken('nope')).toBeNull()
  })

  it('removes a token', () => {
    saveClaimToken('r1', 'token')
    removeClaimToken('r1')
    expect(localStorage.getItem('claim:r1')).toBeNull()
  })

  it('prunes expired and damaged tokens, leaving others alone', () => {
    saveClaimToken('old', 'a', 0)
    saveClaimToken('fresh', 'b', DAY)
    localStorage.setItem('claim:broken', '{}')
    localStorage.setItem('unrelated', 'keep me')

    pruneClaimTokens(DAY + 1)

    expect(localStorage.getItem('claim:old')).toBeNull()
    expect(localStorage.getItem('claim:broken')).toBeNull()
    expect(localStorage.getItem('claim:fresh')).not.toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep me')
  })
})
