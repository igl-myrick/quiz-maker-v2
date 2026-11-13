import type { InfiniteData } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

type ShowMoreQuery<TPage> = {
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<{ hasNextPage: boolean; data?: InfiniteData<TPage> }>
}

// "Show more" for a list built from an infinite query (feature 6, criterion 12; feature 3,
// criterion 9). Focus stays on the button while more pages remain. When the last page
// arrives the button disappears, so focus moves to the link in the first new row.
//
// The first new row is marked at render time, through rowRef(id) on its list item, rather
// than looked up straight after fetchNextPage: the query can resolve before React has
// rendered the new rows. The ref fires when that row is on screen, whichever comes first.
export function useShowMore<TPage extends { items: { id: string }[] }>(
  query: ShowMoreQuery<TPage>,
) {
  // The one piece of state: the row to focus, set only by pressing "Show more".
  const [focusId, setFocusId] = useState<string | null>(null)

  // Stable, so React calls it only when the marked row appears.
  const focusRow = useCallback((row: HTMLElement | null) => {
    if (!row) return
    row.querySelector('a')?.focus()
    setFocusId(null)
  }, [])

  async function showMore() {
    if (query.isFetchingNextPage) return
    const result = await query.fetchNextPage()
    if (result.hasNextPage) return
    setFocusId(result.data?.pages.at(-1)?.items[0]?.id ?? null)
  }

  function rowRef(id: string) {
    return id === focusId ? focusRow : undefined
  }

  return { showMore, rowRef }
}
