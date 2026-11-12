import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { queryClient } from '../lib/queryClient'
import { supabase } from '../lib/supabase'
import { announce } from './announcerStore'

type AuthState = { status: 'loading' } | { status: 'ready'; session: Session | null }

// The only place login state lives. It is 'loading' until Supabase reports
// the first session state (the INITIAL_SESSION event), then 'ready'.
export const useAuthStore = create<AuthState>()(() => ({ status: 'loading' }))

// One subscription for the whole app, set up once when this module loads.
const { data } = supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({ status: 'ready', session }, true)

  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    // Supabase warns that calling Supabase inside this callback can deadlock,
    // so member-only queries are refreshed on the next tick instead.
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
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
