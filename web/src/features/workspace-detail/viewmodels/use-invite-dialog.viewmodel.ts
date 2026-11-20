import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { usePageList } from '@/shared/hooks/use-page-list'
import { ApiError } from '@/shared/services/api-client'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'
import { TEAM_TEXT } from '../constants/team-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { workspaceDetailKeys } from './workspace-detail.keys'

export type InviteRole = 'editor' | 'viewer'

export function useInviteDialogViewModel(workspaceId: string) {
  const { t } = useTranslation('team')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const query = useDeferredValue(search)

  const options = usePageList({
    queryKey: ['workspace-member-options', token, workspaceId, query],
    fetchPage: (cursor) => workspaceDetailService.memberOptionsPage(token, workspaceId, query, cursor),
    enabled: isOpen,
  })

  const addMember = useMutation({
    mutationFn: () => workspaceDetailService.addMember(token, workspaceId, selectedUserId, role),
    onSuccess: () => {
      setIsOpen(false)
      setSearch('')
      setSelectedUserId('')
      setRole('editor')
      const member = options.items.find((item) => item.id === selectedUserId)
      showToast({ kind: 'success', message: t(TEAM_TEXT.toast.added, { email: member?.email ?? '' }) })
      void queryClient.invalidateQueries({ queryKey: workspaceDetailKeys.all })
    },
  })

  function open() {
    addMember.reset()
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedUserId) addMember.mutate()
  }

  return {
    isOpen,
    open,
    close,
    search,
    setSearch,
    users: options.items,
    usersLoading: options.isPending,
    usersHasMore: options.hasMore,
    usersLoadingMore: options.isLoadingMore,
    usersError: options.error ? readErrorMessage(options.error, t(TEAM_TEXT.add.loadFailed)) : null,
    loadMoreUsers: options.loadMore,
    selectedUserId,
    setSelectedUserId,
    role,
    setRole,
    submit,
    isBusy: addMember.isPending,
    errorMessage: addMember.error instanceof ApiError ? addMember.error.message : addMember.error ? t(TEAM_TEXT.invite.failed) : null,
  }
}
