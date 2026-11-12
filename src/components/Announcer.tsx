import { useAnnouncerStore } from '../stores/announcerStore'

// The one live region for the whole app. Rendered once in the root route,
// so it is already on the page before any message arrives.
export function Announcer() {
  const message = useAnnouncerStore((state) => state.message)

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
