import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnnouncerStore } from '../stores/announcerStore'
import { TIME_UP, formatClock, useCountdown } from './useCountdown'

// announce() clears the region, then sets the message 50ms later.
function lastAnnouncement() {
  act(() => vi.advanceTimersByTime(60))
  return useAnnouncerStore.getState().message
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    useAnnouncerStore.setState({ message: '' })
  })
  afterEach(() => vi.useRealTimers())

  it('derives the time left from the start time, so a reload continues it', () => {
    const startedAt = Date.now() - 30_000 // started 30 seconds ago
    const { result } = renderHook(() => useCountdown(startedAt, 120))
    expect(result.current).toBe(90)

    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current).toBe(85)
  })

  it('announces "1 minute left" and "Time\'s up" once each, as they are crossed', () => {
    const startedAt = Date.now()
    const { result } = renderHook(() => useCountdown(startedAt, 62))

    act(() => vi.advanceTimersByTime(2_000))
    expect(result.current).toBe(60)
    expect(lastAnnouncement()).toBe('1 minute left')

    useAnnouncerStore.setState({ message: '' })
    act(() => vi.advanceTimersByTime(30_000))
    expect(lastAnnouncement()).toBe('')

    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(0)
    expect(lastAnnouncement()).toBe(TIME_UP)

    useAnnouncerStore.setState({ message: '' })
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current).toBe(-10)
    expect(lastAnnouncement()).toBe('')
  })

  it('skips the 1-minute warning when the suggested time is exactly 1 minute', () => {
    const startedAt = Date.now()
    renderHook(() => useCountdown(startedAt, 60))
    act(() => vi.advanceTimersByTime(1_000))
    expect(lastAnnouncement()).toBe('')
  })

  it('does not repeat a warning that had already passed before a reload', () => {
    const startedAt = Date.now() - 200_000
    const { result } = renderHook(() => useCountdown(startedAt, 120))
    act(() => vi.advanceTimersByTime(3_000))
    expect(result.current).toBeLessThan(0)
    expect(lastAnnouncement()).toBe('')
  })
})

describe('formatClock', () => {
  it('shows m:ss', () => {
    expect(formatClock(305)).toBe('5:05')
    expect(formatClock(-65)).toBe('1:05')
  })
})
