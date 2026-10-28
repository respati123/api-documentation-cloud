import { useQuery } from '@tanstack/react-query'
import { workspacesService } from '../services/workspaces.service'

export const workspacesKeys = {
  all: ['workspaces'] as const,
  list: (token: string) => [...workspacesKeys.all, 'list', token] as const,
}

export function useWorkspacesQuery(token: string) {
  return useQuery({
    queryKey: workspacesKeys.list(token),
    queryFn: () => workspacesService.list(token),
    enabled: token !== '',
    staleTime: 30_000,
  })
}
