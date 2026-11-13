import { Link } from '@tanstack/react-router'
import { CopyLinkButton } from '../components/result/CopyLinkButton'
import { PersonalityResult } from '../components/result/PersonalityResult'
import { ResultNotices } from '../components/result/ResultNotices'
import { TriviaResult } from '../components/result/TriviaResult'
import { useResult } from '../hooks/useResult'

// Everything shown comes from get_result. Nothing is recalculated or re-randomised.
export function ResultPage({ resultId }: { resultId: string }) {
  const { data, isPending, isError, refetch } = useResult(resultId)

  let content
  if (isPending) {
    content = <h1 tabIndex={-1}>Loading result…</h1>
  } else if (isError) {
    content = (
      <>
        <h1 tabIndex={-1}>Couldn&apos;t load this result</h1>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </>
    )
  } else if (data.status === 'expired') {
    content = (
      <>
        <h1 tabIndex={-1}>Result expired</h1>
        <p>This result has expired. Anonymous results are kept for 1 day.</p>
        <Link to="/search">Find a quiz</Link>
      </>
    )
  } else if (data.status === 'not_found') {
    content = (
      <>
        <h1 tabIndex={-1}>Result not found</h1>
        <p>This result doesn&apos;t exist or has expired. Anonymous results are kept for 1 day.</p>
        <Link to="/search">Find a quiz</Link>
      </>
    )
  } else {
    content = (
      <>
        {data.result.quiz_kind === 'trivia' ? (
          <TriviaResult result={data.result} />
        ) : (
          <PersonalityResult result={data.result} />
        )}
        <ResultNotices data={data} />
        <p>
          <CopyLinkButton />{' '}
          <Link to="/search" className="btn">
            Find another quiz
          </Link>
        </p>
      </>
    )
  }

  return <main className="units-container">{content}</main>
}
