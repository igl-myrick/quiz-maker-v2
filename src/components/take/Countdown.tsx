import { formatClock, useCountdown } from '../../hooks/useCountdown'

type CountdownProps = {
  startedAt: number
  suggestedSeconds: number
}

// The visible countdown. It is deliberately not a live region: the warnings are
// announced once each through the Announcer (see useCountdown), not every second.
export function Countdown({ startedAt, suggestedSeconds }: CountdownProps) {
  const secondsLeft = useCountdown(startedAt, suggestedSeconds)

  return (
    <p className="border padding">
      {secondsLeft > 0
        ? `Time left: ${formatClock(secondsLeft)}`
        : `Over time: ${formatClock(secondsLeft)}`}
      <span className="text-secondary"> (suggested {formatClock(suggestedSeconds)})</span>
    </p>
  )
}
