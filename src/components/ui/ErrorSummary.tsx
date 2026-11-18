import { useId, type ReactNode, type RefObject } from 'react'

type Item = { key: string; targetId: string; text: string }

type ErrorSummaryProps<T extends Item> = {
  summaryRef: RefObject<HTMLDivElement | null>
  heading: string
  // The level that fits the page's outline: 2 on the take, 3 inside an editor part.
  headingLevel: 2 | 3
  items: T[]
  onSelect: (item: T) => void
  // A message from the server, with any action that goes with it. Shown above the list.
  children?: ReactNode
}

// Shown when Next, Submit or Publish can't go ahead. It receives focus, and each item
// links to the field to fix.
export function ErrorSummary<T extends Item>({
  summaryRef,
  heading,
  headingLevel,
  items,
  onSelect,
  children,
}: ErrorSummaryProps<T>) {
  const headingId = useId()
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      className="border padding margin-bottom"
    >
      <Heading id={headingId} className="error">
        {heading}
      </Heading>
      {children}
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.key}>
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
