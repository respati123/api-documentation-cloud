import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { SHELL_TEXT } from '../constants/app-shell-text.constants'
import { useNoticeStore } from '../stores/notice.store'

export function NoticeBanner() {
  const { t } = useTranslation('shell')
  const notice = useNoticeStore((state) => state.notice)
  const dismiss = useNoticeStore((state) => state.dismiss)

  if (!notice) return null
  return (
    <Alert
      variant={notice.kind === 'error' ? 'destructive' : 'default'}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      data-testid="cloud-notice"
      data-kind={notice.kind}
      className="mb-4 flex items-center justify-between gap-3"
    >
      <AlertDescription className="text-sm">{notice.message}</AlertDescription>
      <Button variant="ghost" size="sm" onClick={dismiss}>
        {t(SHELL_TEXT.notice.dismiss)}
      </Button>
    </Alert>
  )
}
