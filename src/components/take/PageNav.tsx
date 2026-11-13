type PageNavProps = {
  page: number
  totalPages: number
  submitting: boolean
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
}

// Previous page, then Next page or (on the last page) Submit answers.
export function PageNav({
  page,
  totalPages,
  submitting,
  onPrevious,
  onNext,
  onSubmit,
}: PageNavProps) {
  const isLast = page >= totalPages

  return (
    <p>
      {page > 1 && (
        <>
          <button type="button" className="btn" onClick={onPrevious}>
            Previous page
          </button>{' '}
        </>
      )}
      {isLast ? (
        <button type="button" className="btn btn-primary" disabled={submitting} onClick={onSubmit}>
          {submitting ? 'Submitting…' : 'Submit answers'}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Next page
        </button>
      )}
    </p>
  )
}
