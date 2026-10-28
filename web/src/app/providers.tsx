import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import '@/shared/i18n'
import { AppErrorBoundary } from '@/shared/errors/app-error-boundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </QueryClientProvider>
  )
}
