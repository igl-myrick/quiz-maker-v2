import { beforeEach, describe, expect, it } from 'vitest'
import { clearNotice, showNotice, useNoticeStore } from './noticeStore'

describe('noticeStore', () => {
  beforeEach(() => useNoticeStore.setState({ notice: null }))

  it('starts empty', () => {
    expect(useNoticeStore.getState().notice).toBeNull()
  })

  it('holds one notice until it is cleared', () => {
    showNotice('Quiz created')
    expect(useNoticeStore.getState().notice).toBe('Quiz created')

    showNotice('Changes saved')
    expect(useNoticeStore.getState().notice).toBe('Changes saved')

    clearNotice()
    expect(useNoticeStore.getState().notice).toBeNull()
  })

  it('never writes to browser storage', () => {
    localStorage.clear()
    sessionStorage.clear()
    showNotice('Quiz created')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
