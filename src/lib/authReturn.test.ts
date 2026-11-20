import { beforeEach, describe, expect, it } from 'vitest'
import { clearAuthReturn, saveAuthReturn, takeAuthReturn } from './authReturn'

describe('auth return state', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/results/abc?from=dashboard')
  })

  it('takes back the page and focus target saved before logging in, once', () => {
    saveAuthReturn('save-result-button')

    expect(takeAuthReturn()).toEqual({
      path: '/results/abc?from=dashboard',
      focusId: 'save-result-button',
    })
    expect(takeAuthReturn()).toEqual({ path: '/' })
  })

  it.each([
    ['another site', JSON.stringify({ path: '//evil.example/steal' })],
    ['another site, written with a backslash', JSON.stringify({ path: '/\\evil.example' })],
    ['a full URL', JSON.stringify({ path: 'https://evil.example/' })],
    ['a relative path', JSON.stringify({ path: 'results/abc' })],
    ['broken JSON', '{not json'],
  ])('goes to the home page when the saved path is %s', (_case, raw) => {
    sessionStorage.setItem('auth:return', raw)

    expect(takeAuthReturn()).toEqual({ path: '/' })
    expect(sessionStorage.getItem('auth:return')).toBeNull()
  })

  it('forgets the saved state when a login could not start', () => {
    saveAuthReturn()
    clearAuthReturn()

    expect(takeAuthReturn()).toEqual({ path: '/' })
  })
})
