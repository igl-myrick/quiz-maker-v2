import { Countdown } from 'quiz-maker'
import { useState } from 'react'

export function TimeLeft() {
  const [startedAt] = useState(() => Date.now() - 95_000)
  return <Countdown startedAt={startedAt} suggestedSeconds={300} />
}

export function OverTime() {
  const [startedAt] = useState(() => Date.now() - 330_000)
  return <Countdown startedAt={startedAt} suggestedSeconds={300} />
}
