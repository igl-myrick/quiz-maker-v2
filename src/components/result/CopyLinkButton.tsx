import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { announce } from '../../stores/announcerStore'

// Copies the result's link. If the browser won't allow it, shows the link in a field instead.
export function CopyLinkButton() {
  const [showLink, setShowLink] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      announce('Link copied')
    } catch {
      flushSync(() => setShowLink(true))
      fieldRef.current?.focus()
      fieldRef.current?.select()
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => void handleCopy()}>
        Copy link
      </button>
      {showLink && (
        <span className="form">
          <label htmlFor="result-link">Result link (copy it from here)</label>
          <input
            ref={fieldRef}
            id="result-link"
            type="text"
            readOnly
            value={window.location.href}
          />
        </span>
      )}
    </>
  )
}
