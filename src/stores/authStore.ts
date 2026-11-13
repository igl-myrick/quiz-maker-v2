import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { queryClient } from '../lib/queryClient'
import { syncSettingsOnAuthChange } from '../lib/settingsSync'
import { supabase } from '../lib/supabase'
import { announce } from './announcerStore'

type AuthState = { status: 'loading' } | { status: 'ready'; session: Session | null }

// The only place login state lives. It is 'loading' until Supabase reports
// the first session state (the INITIAL_SESSION event), then 'ready'.
export const useAuthStore = create<AuthState>()(() => ({ status: 'loading' }))

// One subscription for the whole app, set up once when this module loads.
const { data } = supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({ status: 'ready', session }, true)

  // Supabase warns that calling Supabase inside this callback can deadlock,
  // so member-only work is done on the next tick instead.
  setTimeout(() => {
    void syncSettingsOnAuthChange(event, session)
  }, 0)

  if (event === 'SIGNED_IN') {
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    }, 0)
  } else if (event === 'SIGNED_OUT') {
    // Removed, not just refreshed, so whoever logs in next on this browser never
    // briefly sees the previous member's lists.
    setTimeout(() => {
      queryClient.removeQueries({ queryKey: ['me'] })
    }, 0)
  }
})

// Stop hot reloads in development from stacking up listeners.
import.meta.hot?.dispose(() => {
  data.subscription.unsubscribe()
})

export function useAuthStatus() {
  return useAuthStore((state) => state.status)
}

export function useSession() {
  return useAuthStore((state) => (state.status === 'ready' ? state.session : null))
}

export async function logOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    announce('Something went wrong. Please try again.')
    return
  }
  announce("You're logged out")
}
