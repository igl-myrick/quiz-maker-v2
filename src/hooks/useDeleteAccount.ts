import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { announce } from '../stores/announcerStore'

// Unsaved quiz drafts in this tab (see useQuizDraft).
function removeQuizDrafts() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('quiz-draft:')) sessionStorage.removeItem(key)
  }
}

// Deletes the member's account through the delete-account edge function.
// closeDialogs closes the delete dialog, then the settings dialog.
export function useDeleteAccount(closeDialogs: () => void) {
  const router = useRouter()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
      if (error) throw error
    },
    // Here rather than in a mutate() callback, because the dialogs unmount partway
    // through and a mutate() callback would stop running with them.
    onSuccess: async () => {
      // 1. Before signing out, which hides the members-only section the dialogs live in.
      closeDialogs()
      // 2. Clears this browser's session. supabase-js ignores the server's error for a
      //    user that no longer exists, and still sends SIGNED_OUT.
      await supabase.auth.signOut({ scope: 'local' })
      // 3.
      removeQuizDrafts()
      // 4. The root route moves focus when the path changes. On / it doesn't, so do it here.
      const wasHome = router.state.location.pathname === '/'
      await router.navigate({ to: '/' })
      if (wasHome) document.querySelector<HTMLElement>('h1')?.focus()
      // 5. After the page-change announcement, so it isn't replaced.
      setTimeout(() => announce('Your account has been deleted'), 0)
    },
  })
}
