import { create } from 'zustand'

type NoticeState = {
  notice: string | null
}

// A one-off confirmation for the next page, such as "Quiz created" after publishing
// (specs/12-editor-and-results-polish.md). Kept in memory only: never in the URL,
// history state or browser storage, so a reload doesn't show it again.
export const useNoticeStore = create<NoticeState>()(() => ({ notice: null }))

export function showNotice(notice: string) {
  useNoticeStore.setState({ notice })
}

export function clearNotice() {
  useNoticeStore.setState({ notice: null })
}
