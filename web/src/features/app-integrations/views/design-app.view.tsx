import { ExternalLink, Link2, Unlink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APPS_TEXT } from '@/features/app-integrations/constants/apps-text.constants'
import type { AppName } from '@/features/app-integrations/models/app-integrations.model'
import type { DesignAppViewModel } from '@/features/app-integrations/viewmodels/use-design-app.viewmodel'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/primitives/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { SelectField } from '@/shared/components/select-field'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/state-views'

export interface DesignAppViewProps {
  app: AppName
  vm: DesignAppViewModel
}

export function DesignAppView({ app, vm }: DesignAppViewProps) {
  const { t } = useTranslation()
  if (vm.status === 'loading') return <LoadingState label={t(APPS_TEXT.loading)} testId={`design-${app}-loading`} />
  if (vm.status === 'error')
    return (
      <ErrorState
        title={t(APPS_TEXT.error.title)}
        message={vm.errorMessage ?? ''}
        retryLabel={t(APPS_TEXT.error.retry)}
        onRetry={vm.retry}
        testId={`design-${app}-error`}
      />
    )
  if (vm.enabled && !vm.canUse)
    return <EmptyState title={t(APPS_TEXT.noAccess.title)} detail={t(APPS_TEXT.noAccess.detail)} testId={`design-${app}-no-access`} />
  if (!vm.enabled)
    return (
      <EmptyState
        title={t(APPS_TEXT.notConfigured.title)}
        detail={t(APPS_TEXT.notConfigured.detail)}
        testId={`design-${app}-not-configured`}
      />
    )

  const linkAction = vm.canManage ? (
    <Button size="sm" data-testid={`design-${app}-link-button`} onClick={vm.dialog.open}>
      <Link2 data-icon="inline-start" aria-hidden="true" />
      {t(APPS_TEXT.link)}
    </Button>
  ) : null

  return (
    <div className="grid gap-4" data-testid={`design-${app}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t(APPS_TEXT.title[app])}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t(APPS_TEXT.detail[app])}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {vm.baseUrl && (
            <Button
              size="sm"
              variant="outline"
              data-testid={`design-${app}-open-app-button`}
              onClick={() => vm.openUrl(vm.baseUrl as string)}
            >
              <ExternalLink data-icon="inline-start" aria-hidden="true" />
              {t(APPS_TEXT.openApp, { app: t(APPS_TEXT.title[app]) })}
            </Button>
          )}
          {linkAction}
        </div>
      </div>

      {vm.links.length === 0 ? (
        <EmptyState
          title={t(APPS_TEXT.empty.title)}
          detail={t(vm.canManage ? APPS_TEXT.empty.owner : APPS_TEXT.empty.member)}
          testId={`design-${app}-empty`}
        />
      ) : (
        <Card className="gap-0 py-0">
          <CardHeader className="sr-only">
            <CardTitle>{t(APPS_TEXT.title[app])}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {vm.links.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                  data-testid={`design-${app}-link-${link.projectId}`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{link.name}</span>
                  {link.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`design-${app}-open-${link.projectId}`}
                      onClick={() => vm.openUrl(link.url as string)}
                    >
                      <ExternalLink data-icon="inline-start" aria-hidden="true" />
                      {t(APPS_TEXT.open)}
                    </Button>
                  )}
                  {vm.canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`design-${app}-unlink-${link.projectId}`}
                      disabled={vm.unlinkingId === link.id}
                      onClick={() => vm.unlink(link.id)}
                    >
                      <Unlink data-icon="inline-start" aria-hidden="true" />
                      {t(APPS_TEXT.unlink)}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={vm.dialog.isOpen} onOpenChange={(open) => !open && vm.dialog.close()}>
        <DialogContent data-testid={`design-${app}-link-dialog`}>
          <DialogHeader>
            <DialogTitle>{t(APPS_TEXT.dialog.title, { app: t(APPS_TEXT.title[app]) })}</DialogTitle>
            <DialogDescription>{t(APPS_TEXT.dialog.detail)}</DialogDescription>
          </DialogHeader>
          {vm.dialog.isLoading ? (
            <LoadingState label={t(APPS_TEXT.loading)} />
          ) : vm.dialog.loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{vm.dialog.loadError}</AlertDescription>
            </Alert>
          ) : vm.dialog.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid={`design-${app}-link-dialog-empty`}>
              {t(APPS_TEXT.dialog.empty)}
            </p>
          ) : (
            <SelectField
              id={`design-${app}-project`}
              label={t(APPS_TEXT.dialog.choose)}
              value={vm.dialog.choice}
              onValueChange={vm.dialog.setChoice}
              options={vm.dialog.projects.map((project) => ({ value: project.id, label: project.name }))}
              testId={`design-${app}-project-select`}
            />
          )}
          {vm.dialog.saveError && (
            <Alert variant="destructive">
              <AlertDescription>{vm.dialog.saveError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" data-testid={`design-${app}-link-cancel`} onClick={vm.dialog.close}>
              {t(APPS_TEXT.dialog.cancel)}
            </Button>
            <Button data-testid={`design-${app}-link-confirm`} disabled={!vm.dialog.choice || vm.dialog.isBusy} onClick={vm.dialog.confirm}>
              {t(APPS_TEXT.dialog.confirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
