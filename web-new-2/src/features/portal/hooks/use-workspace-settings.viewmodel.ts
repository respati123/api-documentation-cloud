import { useMutation, useQueryClient } from '@tanstack/react-query'
import { portalService as service } from '../services/portal.service'
import { portalKeys } from './portal.keys'

export function useWorkspaceSettingsViewModel(workspaceId: string, onDeleted: () => void) {
  const queryClient = useQueryClient()

  const rename = useMutation({
    mutationFn: (name: string) => service.renameWorkspace(workspaceId, name),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalKeys.workspaces }),
        queryClient.invalidateQueries({ queryKey: portalKeys.detail(workspaceId, 'snapshot') }),
      ])
    },
  })
  const deleteWorkspace = useMutation({
    mutationFn: (confirmName: string) => service.deleteWorkspace(workspaceId, confirmName),
    onSuccess: async () => {
      onDeleted()
      queryClient.removeQueries({ queryKey: portalKeys.workspace(workspaceId) })
      await queryClient.invalidateQueries({ queryKey: portalKeys.workspaces })
    },
  })

  return { rename, deleteWorkspace }
}
