import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {  } from '@/components/ui/card'
import { Field, FieldGroup, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuLabel, useSidebar } from '@/components/ui/sidebar'
import type { AppNotification } from '../models/portal.model'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { EmptyView, ErrorView, LoadingView } from './state.view'

export function NotificationsMenu({
  vm,
  onOpenNotification,
}: {
  vm: PortalViewModel
  onOpenNotification: (notification: AppNotification) => void
}) {
  const { t } = useTranslation()
  const inbox = vm.notifications.inbox
  const [open, setOpen] = useState(false)
  const { isMobile } = useSidebar()
  const unreadCount = inbox.data?.unreadCount ?? 0
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const unreadAria = unreadCount ? t('notif.unread', { count: unreadCount }) : t('notif.title')
  const failedReadId = vm.notifications.markRead.variables
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) void inbox.refetch()
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          tooltip={unreadAria}
          aria-label={unreadAria}
          aria-expanded={open}
          data-testid="portal-notifications-trigger"
        >
          <Bell aria-hidden="true" />
          <SidebarMenuLabel>{t('notif.title')}</SidebarMenuLabel>
        </SidebarMenuButton>
      </PopoverTrigger>
      {unreadCount > 0 && (
        <SidebarMenuBadge
          aria-hidden="true"
          className="right-2 rounded-full bg-destructive text-destructive-foreground group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:h-2 group-data-[collapsible=icon]:w-2 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:px-0"
        >
          {unreadLabel}
        </SidebarMenuBadge>
      )}
      <PopoverContent
        side={isMobile ? 'top' : 'right'}
        align={isMobile ? 'start' : 'end'}
        className="w-80 max-w-[calc(100vw-3rem)] p-0"
        data-testid="portal-notifications-menu"
      >
        <FieldGroup className="gap-0">
          <FieldGroup className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3">
            <FieldTitle>{t('notif.title')}</FieldTitle>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={vm.notifications.markAllRead.isPending}
                onClick={() => vm.notifications.markAllRead.mutate()}
                data-testid="notifications-mark-all-read"
              >
                {t('notif.markAllRead')}
              </Button>
            )}
          </FieldGroup>
          <Separator />
          <ScrollArea viewportClassName="max-h-[min(28rem,calc(100vh-8rem))] p-2">
            <FieldGroup className="gap-1">
              {inbox.isPending && <LoadingView />}
              {inbox.error && <ErrorView error={inbox.error} retry={() => void inbox.refetch()} />}
              {!inbox.isPending && !inbox.error && inbox.data?.notifications?.length === 0 && (
                <EmptyView
                  title={t('notif.emptyTitle')}
                  description={t('notif.emptyDescription')}
                  testId="notifications-empty-state"
                />
              )}
              {(inbox.data?.notifications ?? []).map(notification => (
                <Button
                  key={notification.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start whitespace-normal px-3 py-2.5 text-left"
                  disabled={vm.notifications.markRead.isPending || vm.notifications.markAllRead.isPending}
                  aria-label={t('notif.openItem', { message: notificationMessage(t, notification) })}
                  onClick={async () => {
                    if (!notification.readAt) {
                      try {
                        await vm.notifications.markRead.mutateAsync(notification.id)
                      } catch {
                        return
                      }
                    }
                    setOpen(false)
                    onOpenNotification(notification)
                  }}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <Field className="w-full gap-1">
                    <FieldGroup className="w-full flex-row items-start gap-2">
                      {notification.readAt === null && <Badge variant="secondary" className="shrink-0">{t('notif.new')}</Badge>}
                      <FieldDescription className="min-w-0 flex-1 text-left text-sm leading-5 text-foreground">
                        {notificationMessage(t, notification)}
                      </FieldDescription>
                    </FieldGroup>
                    <FieldDescription className="text-left text-xs">
                      {formatDate(notification.createdAt)}
                    </FieldDescription>
                  </Field>
                </Button>
              ))}
              {vm.notifications.markRead.error && failedReadId && (
                <ErrorView
                  error={vm.notifications.markRead.error}
                  retry={() => vm.notifications.markRead.mutate(failedReadId)}
                  testId="notifications-read-error"
                />
              )}
              {vm.notifications.markAllRead.error && (
                <ErrorView
                  error={vm.notifications.markAllRead.error}
                  retry={() => vm.notifications.markAllRead.mutate()}
                  testId="notifications-read-all-error"
                />
              )}
            </FieldGroup>
          </ScrollArea>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  )
}

function notificationMessage(t: TFunction, notification: AppNotification): string {
  const actor = value(notification, 'actor') || t('notif.actorFallback')
  const title = value(notification, 'title') || t('notif.taskFallback')
  const preview = value(notification, 'preview')

  switch (notification.kind) {
    case 'mcp_key_ready':
      return t('notif.keyReady', { keyName: value(notification, 'keyName') || t('notif.untitledKey') })
    case 'comment_mention':
      return preview ? t('notif.mentionedPreview', { actor, preview }) : t('notif.mentioned', { actor })
    case 'comment_reply':
      return preview ? t('notif.repliedPreview', { actor, preview }) : t('notif.replied', { actor })
    case 'task_comment':
      return preview ? t('notif.taskCommentedPreview', { actor, preview }) : t('notif.taskCommented', { actor })
    case 'task_assigned':
      return t('notif.assigned', { actor, title })
    case 'design_approved':
      return t('notif.designApproved', { actor, title })
    default:
      return t('notif.fallback')
  }
}

function value(notification: AppNotification, key: string): string {
  const result = notification.data?.[key]
  return typeof result === 'string' ? result.trim() : ''
}

function formatDate(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
