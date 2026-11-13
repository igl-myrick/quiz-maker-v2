// Where focus goes when the person comes back to a page (feature 3, criterion 14).
//
// A page that unmounts when it opens something (the dashboard opening a quiz's popup on
// /search) records the element that opened it, against its own history entry's key.
// When the root route's page-change rule lands on that entry again, it focuses the element
// instead of the <h1>. In memory only, so a full reload falls back to the <h1>.
const targets = new Map<string, string>()

export function rememberReturnFocus(historyKey: string | undefined, elementId: string) {
  if (historyKey) targets.set(historyKey, elementId)
}

// The element to focus on arriving at this history entry, if one was recorded and is on
// the page. The entry is used up either way.
export function takeReturnFocus(historyKey: string | undefined): HTMLElement | null {
  if (!historyKey) return null
  const elementId = targets.get(historyKey)
  targets.delete(historyKey)
  return elementId ? document.getElementById(elementId) : null
}
