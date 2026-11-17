import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { APPS_TEXT } from '@/features/app-integrations/constants/apps-text.constants'
import type { AppName } from '@/features/app-integrations/models/app-integrations.model'
import { appIntegrationsKeys, appIntegrationsService } from '@/features/app-integrations/services/app-integrations.service'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'

// One Design page: the app's linked projects for everyone, and linking or unlinking for the workspace owner.
export function useDesignAppViewModel(workspaceId: string, app: AppName) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [choice, setChoice] = useState('')

  const list = useQuery({ queryKey: appIntegrationsKeys.list(workspaceId), queryFn: () => appIntegrationsService.list(workspaceId) })
  const available = useQuery({
    queryKey: appIntegrationsKeys.available(workspaceId, app),
    queryFn: () => appIntegrationsService.available(workspaceId, app),
    enabled: dialogOpen,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: appIntegrationsKeys.all })

  const link = useMutation({
    mutationFn: () => appIntegrationsService.link(workspaceId, app, choice),
    onSuccess: async () => {
      await refresh()
      setDialogOpen(false)
      setChoice('')
      showToast({ kind: 'success', message: t(APPS_TEXT.linked) })
    },
  })
  const unlink = useMutation({
    mutationFn: (linkId: string) => appIntegrationsService.unlink(workspaceId, linkId),
    onSuccess: async () => {
      await refresh()
      showToast({ kind: 'success', message: t(APPS_TEXT.unlinked) })
    },
    onError: (error) => showToast({ kind: 'error', message: readErrorMessage(error, t(APPS_TEXT.error.fallback)) }),
  })

  const current = list.data?.apps.find((item) => item.app === app)
  return {
    status: list.isPending ? ('loading' as const) : list.isError ? ('error' as const) : ('ready' as const),
    errorMessage: list.error ? readErrorMessage(list.error, t(APPS_TEXT.error.fallback)) : null,
    retry: () => void list.refetch(),
    enabled: current?.enabled ?? false,
    canUse: current?.canUse ?? false,
    baseUrl: current?.baseUrl ?? null,
    links: current?.links ?? [],
    canManage: list.data?.canManage ?? false,
    openUrl: (url: string) => window.open(url, '_blank', 'noopener,noreferrer'),
    unlink: (linkId: string) => unlink.mutate(linkId),
    unlinkingId: unlink.isPending ? (unlink.variables ?? null) : null,
    dialog: {
      isOpen: dialogOpen,
      open: () => setDialogOpen(true),
      close: () => {
        setDialogOpen(false)
        setChoice('')
        link.reset()
      },
      projects: available.data ?? [],
      isLoading: available.isPending,
      loadError: available.error ? readErrorMessage(available.error, t(APPS_TEXT.error.fallback)) : null,
      choice,
      setChoice,
      confirm: () => {
        if (choice) link.mutate()
      },
      isBusy: link.isPending,
      saveError: link.error ? readErrorMessage(link.error, t(APPS_TEXT.error.fallback)) : null,
    },
  }
}

export type DesignAppViewModel = ReturnType<typeof useDesignAppViewModel>
