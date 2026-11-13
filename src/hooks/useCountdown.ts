import { useEffect, useState } from 'react'
import { announce } from '../stores/announcerStore'

const ONE_MINUTE_LEFT = '1 minute left'
export const TIME_UP = "Time's up. You can keep going and submit when you're ready."

function secondsLeftAt(time: number, startedAt: number, suggestedSeconds: number) {
  return Math.ceil((startedAt + suggestedSeconds * 1000 - time) / 1000)
}

// The seconds left on an advisory timer (negative once it has run over). Nothing locks
// or submits when it reaches zero (CLAUDE.md section 9).
//
// The one ticking effect in this feature: a 1-second interval that updates `now`, cleared
// on cleanup. Remaining time is derived from startedAt, so a reload continues the
// countdown. The 1-minute and time's-up warnings are announced from the interval, only
// when a tick crosses them, so a reload after a warning doesn't repeat it.
export function useCountdown(startedAt: number, suggestedSeconds: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let previous = Date.now()
    const interval = setInterval(() => {
      const current = Date.now()
      const before = secondsLeftAt(previous, startedAt, suggestedSeconds)
      const after = secondsLeftAt(current, startedAt, suggestedSeconds)
      if (suggestedSeconds > 60 && before > 60 && after <= 60) announce(ONE_MINUTE_LEFT)
      if (before > 0 && after <= 0) announce(TIME_UP)
      previous = current
      setNow(current)
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, suggestedSeconds])

  return secondsLeftAt(now, startedAt, suggestedSeconds)
}

// m:ss for a number of seconds (always positive).
export function formatClock(totalSeconds: number) {
  const seconds = Math.abs(totalSeconds)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
