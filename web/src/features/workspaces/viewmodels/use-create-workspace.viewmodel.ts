import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { COMMON_TEXT } from '@/shared/constants/common-text.constants'
import { ApiError } from '@/shared/services/api-client'
import { workspacesService } from '../services/workspaces.service'
import { useCreateWorkspaceStore } from '../stores/create-workspace.store'
import { workspacesKeys } from './use-workspaces.viewmodel'

export function useCreateWorkspaceViewModel(onCreated: (workspace: { id: string; name: string }) => void) {
  const { t } = useTranslation(['workspaces', 'common'])
  const queryClient = useQueryClient()
  const token = useAuthSessionStore((state) => state.token)
  const isOpen = useCreateWorkspaceStore((state) => state.isOpen)
  const close = useCreateWorkspaceStore((state) => state.close)

  const creation = useMutation({
    mutationFn: (name: string) => workspacesService.create(token, name),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: workspacesKeys.all })
      close()
      creation.reset()
      onCreated(workspace)
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    if (name) creation.mutate(name)
  }

  function handleClose() {
    creation.reset()
    close()
  }

  return {
    isOpen,
    isBusy: creation.isPending,
    errorMessage: creation.error ? (creation.error instanceof ApiError ? creation.error.message : t(COMMON_TEXT.error.unexpected)) : null,
    handleSubmit,
    handleClose,
  }
}
