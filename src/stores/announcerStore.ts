import { create } from 'zustand'

type AnnouncerState = {
  message: string
}

// Holds the text of the one app-level live region (see Announcer.tsx).
export const useAnnouncerStore = create<AnnouncerState>()(() => ({ message: '' }))

// Announce a message to screen readers. Call this from event handlers only.
// The region is cleared first so that repeating the same message is still read out.
export function announce(message: string) {
  useAnnouncerStore.setState({ message: '' })
  setTimeout(() => {
    useAnnouncerStore.setState({ message })
  }, 50)
}
