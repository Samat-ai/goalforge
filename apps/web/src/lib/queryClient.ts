import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api-error'

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    // Surface network / timeout messages but keep them user-friendly
    if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('timeout')) {
      return 'Network error — please check your connection'
    }
    return error.message || 'Something went wrong'
  }
  return 'Something went wrong'
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (auth / not found / validation)
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
      onError: (error) => {
        // 402 errors have dedicated inline UI (upgrade prompts); skip toast for those
        if (error instanceof ApiError && error.status === 402) return
        toast.error(getErrorMessage(error))
      },
    },
  },
})
