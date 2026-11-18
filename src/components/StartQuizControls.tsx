import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useStartTake } from '../hooks/useTakeQuiz'
import { formatSuggestedTime } from '../lib/formatSuggestedTime'
import { useTakeForQuiz } from '../stores/takeStore'
import { useConfirmDialog } from './ConfirmDialog'
import { Switch } from './ui/Switch'

type StartQuizControlsProps = {
  quizId: string
  suggestedTimeSeconds: number | null
  // "Start quiz" normally; "Start the current version" after the quiz changed.
  startLabel?: string
  // True when replacing a take that can no longer be submitted: no "Start over?" question
  // and no "Continue your quiz" link.
  isRestart?: boolean
  // 'popup' in the quiz details popup, whose meta line already shows the suggested time:
  // the time isn't repeated, and "No suggested time" takes the switch's place.
  variant?: 'page' | 'popup'
}

// The timer choice and Start button, in the quiz details popup and on the take page.
export function StartQuizControls({
  quizId,
  suggestedTimeSeconds,
  startLabel = 'Start quiz',
  isRestart = false,
  variant = 'page',
}: StartQuizControlsProps) {
  // The timer starts enabled, honouring the creator's suggestion (CLAUDE.md section 9).
  const [timerOn, setTimerOn] = useState(true)
  const startTake = useStartTake()
  const takeInProgress = useTakeForQuiz(quizId)
  const { confirm, dialog } = useConfirmDialog()
  const hasTimer = suggestedTimeSeconds !== null

  async function handleStart() {
    if (takeInProgress && !isRestart) {
      const confirmed = await confirm({
        title: 'Start over?',
        body: 'You have a quiz in progress. Starting again clears your answers.',
        confirmLabel: 'Start over',
      })
      if (!confirmed) return
    }
    startTake.mutate({ quizId, timed: hasTimer && timerOn })
  }

  return (
    <div>
      {startTake.isError && (
        <p role="alert" className="error">
          Couldn&apos;t start the quiz. Try again.
        </p>
      )}

      <div className="start-controls" data-variant={variant}>
        {hasTimer ? (
          <div className="start-controls-timer">
            <Switch
              checked={timerOn}
              onChange={setTimerOn}
              ariaLabel="Timer"
              label={timerOn ? 'Timer enabled' : 'Timer disabled'}
            />
            {variant === 'page' && (
              <span className="text-secondary">{formatSuggestedTime(suggestedTimeSeconds)}</span>
            )}
          </div>
        ) : (
          variant === 'popup' && <span className="no-timer-note">No suggested time</span>
        )}

        <div className="btn-group">
          <button
            type="button"
            className="btn btn-primary"
            disabled={startTake.isPending}
            onClick={() => void handleStart()}
          >
            {startTake.isPending ? 'Starting…' : startLabel}
          </button>
          {takeInProgress && !isRestart && (
            <Link
              to="/quizzes/$quizId/take"
              params={{ quizId }}
              search={{ page: 1 }}
              className="btn"
            >
              Continue your quiz
            </Link>
          )}
        </div>
      </div>
      {dialog}
    </div>
  )
}
