import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useId } from 'react'
import { LoginButton } from '../components/LoginButton'
import { StartQuizControls } from '../components/StartQuizControls'
import { Countdown } from '../components/take/Countdown'
import { PageNav } from '../components/take/PageNav'
import { QuestionFieldset, firstInputId } from '../components/take/QuestionFieldset'
import { ErrorSummary } from '../components/ui/ErrorSummary'
import { KindChip } from '../components/ui/KindChip'
import { usePagedForm, type SummaryItem } from '../hooks/usePagedForm'
import { useQuizDetails } from '../hooks/useQuizDetails'
import { SubmitError, useSubmitQuiz } from '../hooks/useSubmitQuiz'
import { saveClaimToken } from '../lib/claimTokens'
import { useSession } from '../stores/authStore'
import {
  takeKey,
  unansweredIds,
  useTakeForQuiz,
  useTakeStore,
  type Take,
} from '../stores/takeStore'

export const QUESTIONS_PER_PAGE = 10

type TakePageProps = {
  quizId: string
  page: number
}

export function TakePage({ quizId, page }: TakePageProps) {
  const take = useTakeForQuiz(quizId)

  return (
    // Personality takes turn the page's buttons, controls and focus purple.
    <main
      className="units-container"
      data-kind={take?.quiz.kind === 'personality' ? 'personality' : undefined}
    >
      {take ? <TakeInProgress take={take} page={page} /> : <NotStarted quizId={quizId} />}
    </main>
  )
}

// A pasted link or a new tab, with no take stored: offer to start.
function NotStarted({ quizId }: { quizId: string }) {
  const { data: quiz, isPending, isError, refetch } = useQuizDetails(quizId)

  if (isPending) return <h1 tabIndex={-1}>Loading quiz…</h1>
  if (isError) {
    return (
      <>
        <h1 tabIndex={-1}>Couldn&apos;t load this quiz</h1>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </>
    )
  }
  if (quiz === null) {
    return (
      <>
        <h1 tabIndex={-1}>Quiz not found</h1>
        <p>This quiz no longer exists.</p>
        <Link to="/search">Find another quiz</Link>
      </>
    )
  }
  return (
    <>
      <h1 tabIndex={-1}>{quiz.title}</h1>
      <StartQuizControls quizId={quiz.id} suggestedTimeSeconds={quiz.suggested_time_seconds} />
    </>
  )
}

const MEMBER_LIMIT_MESSAGE =
  "You've submitted a lot of quizzes in the last hour. Please wait a few minutes and try again. Your answers are saved."
const ANON_LIMIT_MESSAGE =
  'Too many quizzes have been sent from this internet connection in the last hour. Please wait a few minutes and try again. Your answers are saved. Logging in also lets you submit, because members have their own limit.'

function TakeInProgress({ take, page }: { take: Take; page: number }) {
  const key = takeKey(take.quiz.id, take.quiz.version)
  const questions = take.quiz.questions
  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE))
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const submit = useSubmitQuiz()
  const session = useSession()
  const navigate = useNavigate()
  const clearTake = useTakeStore((state) => state.clear)
  const answeredId = useId()
  const { headingRef, summaryRef, ...form } = usePagedForm({
    steps: pages,
    current: page,
    goToStep: (next) => navigate({ to: '.', search: { page: next } }),
    describeStep: (p, _index, total) => `Page ${p} of ${total}`,
  })

  // A page past the end (say, after a typo in the URL) shows the last page.
  if (page > totalPages) return <Navigate to="." search={{ page: totalPages }} replace />

  const pageQuestions = questions.slice((page - 1) * QUESTIONS_PER_PAGE, page * QUESTIONS_PER_PAGE)
  const pageIds = pageQuestions.map((question) => question.id)
  const allIds = questions.map((question) => question.id)
  const answeredCount = allIds.length - unansweredIds(take, allIds).length
  const submitError = submit.error instanceof SubmitError ? submit.error : null

  // The questions listed depend on which check the person last asked for. The answers
  // themselves always come from the take store.
  let missingIds: string[] = []
  if (form.lastCheck === 'step') missingIds = unansweredIds(take, pageIds)
  if (form.lastCheck === 'finish') missingIds = unansweredIds(take, allIds)
  if (submitError?.code === 'unanswered') {
    missingIds = [...new Set([...missingIds, ...unansweredIds(take, submitError.questionIds)])]
  }
  const missingItems: SummaryItem<number>[] = missingIds.map((id) => {
    const index = allIds.indexOf(id)
    return {
      key: id,
      step: Math.floor(index / QUESTIONS_PER_PAGE) + 1,
      text: `Question ${index + 1}: ${questions[index]?.prompt ?? ''}`,
      targetId: firstInputId(id),
    }
  })

  function handleSubmit() {
    if (unansweredIds(take, allIds).length > 0) {
      form.showSummary('finish')
      return
    }
    submit.mutate(
      {
        quiz_id: take.quiz.id,
        quiz_version: take.quiz.version,
        answers: Object.fromEntries(allIds.map((id) => [id, take.answers[id] ?? []])),
        timed: take.timed,
        started_at: take.startedAt === null ? null : new Date(take.startedAt).toISOString(),
      },
      {
        onSuccess: ({ result_id, claim_token }) => {
          if (claim_token) saveClaimToken(result_id, claim_token)
          // Clear the take once the result page is showing, so this page never flashes
          // its "not started" state. replace: Back shouldn't return to an empty take.
          void navigate({
            to: '/results/$resultId',
            params: { resultId: result_id },
            replace: true,
          }).then(() => clearTake(key))
        },
        onError: () => form.showSummary('finish'),
      },
    )
  }

  // What the server said, and what the person can do about it.
  let serverMessage = null
  if (submitError && submitError.code !== 'unanswered') {
    if (submitError.status === 401) {
      serverMessage = (
        <>
          <p>You&apos;ve been logged out. Log in to submit.</p>
          <LoginButton />
        </>
      )
    } else if (submitError.code === 'quiz_changed' || submitError.code === 'invalid_answers') {
      serverMessage = (
        <>
          <p>
            {submitError.code === 'quiz_changed'
              ? "This quiz changed more than a day after you started, so these answers can't be graded."
              : "Something about these answers didn't match the quiz. Please start again."}
          </p>
          <StartQuizControls
            quizId={take.quiz.id}
            suggestedTimeSeconds={take.quiz.suggested_time_seconds}
            startLabel="Start the current version"
            isRestart
          />
        </>
      )
    } else if (submitError.code === 'quiz_deleted') {
      serverMessage = (
        <p>
          This quiz no longer exists. <Link to="/search">Find another quiz</Link>
        </p>
      )
    } else if (submitError.status === 429) {
      serverMessage = <p>{session ? MEMBER_LIMIT_MESSAGE : ANON_LIMIT_MESSAGE}</p>
    } else {
      serverMessage = <p>Couldn&apos;t submit. Check your connection and try again.</p>
    }
  }

  let summaryHeading = "Couldn't submit your answers"
  if (form.lastCheck === 'step') summaryHeading = 'Answer these questions to continue'
  if (form.lastCheck === 'finish' || submitError?.code === 'unanswered')
    summaryHeading = 'Answer these questions before submitting'

  return (
    <>
      <div className="take-head">
        <div>
          <KindChip kind={take.quiz.kind} />
          <h1 tabIndex={-1}>{take.quiz.title}</h1>
        </div>
        {take.timed && take.startedAt !== null && take.quiz.suggested_time_seconds !== null && (
          <Countdown
            startedAt={take.startedAt}
            suggestedSeconds={take.quiz.suggested_time_seconds}
          />
        )}
      </div>

      {(missingItems.length > 0 || serverMessage) && (
        <ErrorSummary
          summaryRef={summaryRef}
          heading={missingItems.length > 0 ? summaryHeading : "Couldn't submit your answers"}
          headingLevel={2}
          items={missingItems}
          onSelect={(item) => void form.selectItem(item)}
        >
          {serverMessage}
        </ErrorSummary>
      )}

      <h2 ref={headingRef} tabIndex={-1} className="take-page-heading">
        {form.stepHeading}
      </h2>
      {/* Answered questions, not pages: the heading already says the page. */}
      <div className="take-progress">
        <p id={answeredId}>
          {answeredCount} of {questions.length} answered
        </p>
        <progress max={questions.length} value={answeredCount} aria-labelledby={answeredId} />
      </div>

      {pageQuestions.map((question) => (
        <QuestionFieldset
          key={question.id}
          takeKey={key}
          question={question}
          number={allIds.indexOf(question.id) + 1}
          total={questions.length}
          chosen={take.answers[question.id] ?? []}
          showMissing={missingIds.includes(question.id)}
        />
      ))}

      <PageNav
        page={page}
        totalPages={totalPages}
        submitting={submit.isPending}
        onPrevious={() => void form.back()}
        onNext={() => void form.next(() => unansweredIds(take, pageIds).length === 0)}
        onSubmit={handleSubmit}
      />
    </>
  )
}
