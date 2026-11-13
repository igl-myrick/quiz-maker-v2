import { useId, type ReactNode, type RefObject } from 'react'

export type MissingItem = {
  questionId: string
  text: string
  targetId: string
}

type ErrorSummaryProps = {
  summaryRef: RefObject<HTMLDivElement | null>
  heading: string
  items: MissingItem[]
  onSelect: (item: MissingItem) => void
  // A message from the server, with any action that goes with it.
  children?: ReactNode
}

// Shown above the questions when Next page or Submit can't go ahead. It receives focus.
export function ErrorSummary({
  summaryRef,
  heading,
  items,
  onSelect,
  children,
}: ErrorSummaryProps) {
  const headingId = useId()

  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      className="border padding margin-bottom"
    >
      <h2 id={headingId} className="error">
        {heading}
      </h2>
      {children}
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.questionId}>
              <a
                href={`#${item.targetId}`}
                onClick={(event) => {
                  event.preventDefault()
                  onSelect(item)
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
