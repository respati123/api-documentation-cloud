import { Toast } from '@base-ui/react/toast'
import { Bell, CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/primitives/button'
import { COMMON_TEXT } from '@/shared/constants/common-text.constants'
import { TOAST_LIMIT, type ToastData, type ToastKind, toastManager } from '@/shared/toast/toast-manager'
import { cn } from '@/shared/utils/cn'

const KIND_ICON: Record<ToastKind, typeof Info> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
  notification: Bell,
}

const KIND_ACCENT: Record<ToastKind, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-primary',
  notification: 'text-primary',
}

function readKind(type: string | undefined): ToastKind {
  return type === 'success' || type === 'error' || type === 'notification' ? type : 'info'
}

// The toast stack floats over the top right of the app, above dialogs, so messages never push the page content.
export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={TOAST_LIMIT}>
      <ToastStack />
    </Toast.Provider>
  )
}

function ToastStack() {
  const { t } = useTranslation()
  const { toasts } = Toast.useToastManager<ToastData>()
  return (
    <Toast.Portal>
      <Toast.Viewport
        aria-label={t(COMMON_TEXT.toast.region)}
        data-testid="cloud-toast-viewport"
        className="fixed top-4 right-4 left-4 z-[100] flex flex-col gap-2 outline-none sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => {
          const kind = readKind(toast.type)
          const Icon = KIND_ICON[kind]
          const onOpen = toast.data?.onOpen
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection={['right', 'up']}
              data-testid="cloud-toast"
              data-kind={kind}
              className={cn(
                'relative rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5',
                'translate-x-[var(--toast-swipe-movement-x)] translate-y-[var(--toast-swipe-movement-y)] transition-[opacity,translate] duration-200 ease-out',
                'data-[starting-style]:translate-x-6 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[limited]:hidden',
                'data-[swiping]:transition-none motion-reduce:transition-none',
                kind === 'error' && 'border-destructive/40',
              )}
            >
              <Toast.Content className="flex items-start gap-3 py-3 pr-10 pl-3">
                <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', KIND_ACCENT[kind])} />
                <div className="grid min-w-0 flex-1 gap-1">
                  {toast.title && <Toast.Title className="text-sm font-medium" />}
                  <Toast.Description
                    data-testid="cloud-toast-message"
                    className={cn('text-sm break-words', toast.title ? 'text-muted-foreground' : 'text-foreground')}
                  />
                  {onOpen && (
                    <Toast.Action
                      render={
                        <Button variant="link" size="sm" className="h-auto justify-self-start p-0" data-testid="cloud-toast-open-button" />
                      }
                      onClick={() => {
                        onOpen()
                        toastManager.close(toast.id)
                      }}
                    >
                      {t(COMMON_TEXT.toast.open)}
                    </Toast.Action>
                  )}
                </div>
                <Toast.Close
                  aria-label={t(COMMON_TEXT.toast.close)}
                  render={
                    <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" data-testid="cloud-toast-close-button" />
                  }
                >
                  <X aria-hidden="true" />
                </Toast.Close>
              </Toast.Content>
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
