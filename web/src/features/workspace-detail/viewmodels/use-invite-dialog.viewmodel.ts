import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNoticeStore } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { ApiError } from '@/shared/services/api-client'
import { TEAM_TEXT } from '../constants/team-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { workspaceDetailKeys } from './workspace-detail.keys'

export type InviteRole = 'editor' | 'viewer'

export function useInviteDialogViewModel(workspaceId: string) {
  const { t } = useTranslation('team')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const showNotice = useNoticeStore((state) => state.show)
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [lastInviteLink, setLastInviteLink] = useState('')

  const invite = useMutation({
    mutationFn: async () => {
      const result = await workspaceDetailService.createInvite(token, workspaceId, email.trim(), role)
      const link = new URL(`/invite?token=${encodeURIComponent(result.token)}`, window.location.origin).toString()
      return { ...result, link }
    },
    onSuccess: (result) => {
      setLastInviteLink(result.link)
      setEmail('')
      setIsOpen(false)
      showNotice({
        kind: result.emailSent ? 'success' : 'info',
        message: result.emailSent
          ? t(TEAM_TEXT.invite.sent, { email: result.email })
          : t(TEAM_TEXT.invite.created, { email: result.email }),
      })
      void queryClient.invalidateQueries({ queryKey: workspaceDetailKeys.invites(token, workspaceId) })
    },
  })

  function open() {
    invite.reset()
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (email.trim()) invite.mutate()
  }

  async function copyLink() {
    if (!lastInviteLink) return
    try {
      await navigator.clipboard.writeText(lastInviteLink)
      showNotice({ kind: 'success', message: t(TEAM_TEXT.invite.copied) })
    } catch {
      showNotice({ kind: 'error', message: t(TEAM_TEXT.invite.clipboardUnavailable) })
    }
  }

  return {
    isOpen,
    open,
    close,
    email,
    setEmail,
    role,
    setRole,
    submit,
    isBusy: invite.isPending,
    errorMessage: invite.error ? (invite.error instanceof ApiError ? invite.error.message : t(TEAM_TEXT.invite.failed)) : null,
    lastInviteLink,
    copyLink,
  }
}
