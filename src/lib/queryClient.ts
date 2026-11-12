import { QueryClient } from '@tanstack/react-query'

// The one QueryClient for the whole app, created once at module load.
export const queryClient = new QueryClient()
