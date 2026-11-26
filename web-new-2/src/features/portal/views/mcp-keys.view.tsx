import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Check, Copy, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminMcpKey, McpKey, McpKeyValidDays } from '../models/portal.model'
import type { McpKeysViewModel } from '../hooks/use-mcp-keys.viewmodel'
import { mcpSetupPrompt } from '../utils/mcp-setup-prompt'
import { ErrorView, EmptyView, LoadingView } from './state.view'

function validDaysOptions(t: TFunction): Array<{ value: string; label: string }> {
  return [
    { value: '30', label: t('mcp.days30') },
    { value: '90', label: t('mcp.days90') },
    { value: '365', label: t('mcp.year1') },
    { value: 'never', label: t('mcp.expiryNever') },
  ]
}

export function MyMcpKeysView({ vm }: { vm: McpKeysViewModel }) {
  const { t } = useTranslation()
  const keys = vm.keys
  const endpoint = `${window.location.origin}/api/mcp`
  const claudeCommand = keys.createdSecret
    ? `claude mcp add --transport http --scope user api-documentation-cloud ${endpoint} --header "Authorization: Bearer ${keys.createdSecret.secret}"`
    : ''
  const codexConfig = keys.createdSecret
    ? `[mcp_servers.api-documentation-cloud]\nurl = "${endpoint}"\n\n[mcp_servers.api-documentation-cloud.http_headers]\nAuthorization = "Bearer ${keys.createdSecret.secret}"`
    : ''
  const setupPrompt = keys.createdSecret ? mcpSetupPrompt(endpoint, keys.createdSecret.secret) : ''

  return (
    <FieldGroup className="gap-5" data-testid="mcp-keys-page">
      <FieldGroup className="flex-row flex-wrap items-center justify-between gap-3">
        <FieldDescription>
          {keys.limit > 0 ? t('mcp.activeCount', { active: keys.activeCount, limit: keys.limit }) : t('mcp.limitUnavailable')}
        </FieldDescription>
        <Button disabled={!keys.canCreate} onClick={keys.onOpenCreate} data-testid="mcp-key-create-open">
          {t('mcp.createKey')}
        </Button>
      </FieldGroup>

      {keys.createdSecret && (
        <Card data-testid="mcp-key-created-secret">
          <CardHeader>
            <CardTitle className="text-base">{t('mcp.copyNowTitle')}</CardTitle>
            <CardDescription>
              {t('mcp.copyNowDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup className="gap-2">
              <FieldTitle className="text-sm font-medium text-foreground">{t('mcp.secret')}</FieldTitle>
              <SecretValue value={keys.createdSecret.secret} testId="mcp-key-secret" />
            </FieldGroup>
            <FieldGroup className="gap-2">
              <FieldTitle className="text-sm font-medium text-foreground">{t('mcp.setupPromptTitle')}</FieldTitle>
              <CardDescription className="text-xs">
                {t('mcp.setupPromptDescription')}
              </CardDescription>
              <SecretValue value={setupPrompt} multiline testId="mcp-key-setup-prompt" />
            </FieldGroup>
            <FieldGroup className="gap-2">
              <FieldTitle className="text-sm font-medium text-foreground">{t('mcp.manualClaude')}</FieldTitle>
              <SecretValue value={claudeCommand} testId="mcp-key-claude-command" />
            </FieldGroup>
            <FieldGroup className="gap-2">
              <FieldTitle className="text-sm font-medium text-foreground">{t('mcp.manualCodex')}</FieldTitle>
              <SecretValue value={codexConfig} multiline testId="mcp-key-codex-config" />
            </FieldGroup>
            <Button variant="outline" onClick={keys.dismissSecret} data-testid="mcp-key-secret-dismiss">
              {t('mcp.done')}
            </Button>
          </CardContent>
        </Card>
      )}

      {keys.revokeError && <ErrorView error={keys.revokeError} testId="mcp-key-revoke-error" />}
      {keys.status === 'error' ? (
        <ErrorView error={keys.error!} retry={keys.retry} testId="mcp-key-load-error" />
      ) : keys.status === 'loading' ? (
        <LoadingView />
      ) : keys.status === 'empty' ? (
        <EmptyView title={t('mcp.noKeys')} description={t('mcp.noKeysDescription')} testId="mcp-key-empty" />
      ) : (
        <McpKeyTable keys={keys.items} revokingId={keys.revokingId} onRevoke={keys.revoke} testId="mcp-key-list" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.accessTitle')}</CardTitle>
          <CardDescription>{t('mcp.accessDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {keys.accessStatus === 'loading' ? (
            <LoadingView />
          ) : keys.accessStatus === 'error' ? (
            <ErrorView error={keys.accessError!} retry={keys.retryAccess} testId="mcp-access-load-error" />
          ) : !keys.access.length ? (
        <EmptyView title={t('mcp.noAccess')} description={t('mcp.noAccessDescription')} testId="mcp-access-empty" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('mcp.colWorkspace')}</TableHead>
                  <TableHead>{t('mcp.colRoles')}</TableHead>
                  <TableHead>{t('mcp.colTools')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.access.map(workspace => (
                  <TableRow key={workspace.id} data-testid={`mcp-access-workspace-${workspace.id}`}>
                    <TableCell className="font-medium">{workspace.name}</TableCell>
                    <TableCell>
                      <FieldGroup className="flex-row flex-wrap gap-1">
                        {workspace.roles.map(role => <Badge key={role} variant="outline">{t(`role.${role}`)}</Badge>)}
                      </FieldGroup>
                    </TableCell>
                    <TableCell>
                      <FieldGroup className="flex-row flex-wrap gap-1">
                        <CardDescription className="whitespace-normal text-xs">
                          {workspace.tools.length ? workspace.tools.join(', ') : t('mcp.noTools')}
                        </CardDescription>
                      </FieldGroup>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mcp.guideTitle')}</CardTitle>
          <CardDescription>
            {keys.guide ? t('mcp.guideMeta', { version: keys.guide.version, roles: keys.guide.roles.join(', ') || t('mcp.none') }) : t('mcp.guideDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys.guideStatus === 'loading' ? (
            <LoadingView />
          ) : keys.guideStatus === 'error' ? (
            <ErrorView error={keys.guideError!} retry={keys.retryGuide} testId="mcp-guide-load-error" />
          ) : (
            <ScrollArea className="rounded-md bg-muted" viewportClassName="max-h-96 p-4">
              <FieldDescription className="whitespace-pre-wrap font-mono text-xs text-foreground" data-testid="mcp-guide-content">
                {keys.guide?.guide || t('mcp.noGuide')}
              </FieldDescription>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={keys.createOpen} onOpenChange={open => keys.setCreateOpen(open)}>
        <DialogContent data-testid="mcp-key-create-dialog">
          <FieldGroup
            className="gap-4"
            onKeyDown={event => {
              if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                event.preventDefault()
                if (keys.canSubmit) keys.submitCreate()
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('mcp.createTitle')}</DialogTitle>
              <DialogDescription>{t('mcp.createDescription')}</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="mcp-key-name">{t('mcp.keyName')}</FieldLabel>
              <Input
                id="mcp-key-name"
                autoFocus
                maxLength={80}
                value={keys.name}
                onChange={event => keys.setName(event.target.value)}
                placeholder={t('mcp.namePlaceholder')}
                data-testid="mcp-key-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="mcp-key-expiry">{t('mcp.expires')}</FieldLabel>
              <Select
                value={keys.validDays === null ? 'never' : String(keys.validDays)}
                onValueChange={value => keys.setValidDays(parseValidDays(value))}
              >
                <SelectTrigger id="mcp-key-expiry" data-testid="mcp-key-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validDaysOptions(t).map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {keys.validDays === null && (
              <FieldDescription>{t('mcp.noExpiryNote')}</FieldDescription>
            )}
            {keys.createError && <ErrorView error={keys.createError} testId="mcp-key-create-error" />}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => keys.setCreateOpen(false)}>{t('common.cancel')}</Button>
              <Button type="button" disabled={!keys.canSubmit} onClick={keys.submitCreate} data-testid="mcp-key-create-submit">
                {keys.createPending ? t('common.creating') : t('mcp.createKey')}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </DialogContent>
      </Dialog>
    </FieldGroup>
  )
}

export function AdminMcpKeysView({ vm }: { vm: McpKeysViewModel }) {
  const { t } = useTranslation()
  const admin = vm.admin
  return (
    <FieldGroup className="gap-5" data-testid="admin-mcp-keys-page">
      <Field className="max-w-md">
        <FieldLabel htmlFor="admin-mcp-key-search">{t('mcp.adminSearchLabel')}</FieldLabel>
        <FieldGroup className="relative">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-mcp-key-search"
            type="search"
            className="pl-9"
            value={admin.search}
            onChange={event => admin.setSearch(event.target.value)}
            data-testid="admin-mcp-key-search"
          />
        </FieldGroup>
      </Field>
      {admin.revokeError && <ErrorView error={admin.revokeError} testId="admin-mcp-key-revoke-error" />}
      {admin.status === 'error' ? (
        <ErrorView error={admin.error!} retry={admin.retry} testId="admin-mcp-key-load-error" />
      ) : admin.status === 'loading' ? (
        <LoadingView />
      ) : admin.status === 'empty' ? (
        <EmptyView title={t('mcp.noMatchingKeys')} description={t('mcp.noMatchingKeysDescription')} testId="admin-mcp-key-empty" />
      ) : (
        <>
          <McpKeyTable keys={admin.items} showOwner revokingId={admin.revokingId} onRevoke={admin.revoke} testId="admin-mcp-key-list" />
          {admin.hasNextPage && (
            <Button variant="outline" disabled={admin.isFetchingNextPage} onClick={admin.loadMore} data-testid="admin-mcp-key-load-more">
              {admin.isFetchingNextPage ? t('common.loadingEllipsis') : t('mcp.loadMoreKeys')}
            </Button>
          )}
        </>
      )}
    </FieldGroup>
  )
}

function McpKeyTable<T extends McpKey | AdminMcpKey>({
  keys,
  showOwner = false,
  revokingId,
  onRevoke,
  testId,
}: {
  keys: T[]
  showOwner?: boolean
  revokingId: string | null
  onRevoke: (key: T) => void
  testId: string
}) {
  const { t } = useTranslation()
  return (
    <Card className="overflow-hidden py-0" data-testid={testId}>
      <Table>
        <TableHeader>
          <TableRow>
            {showOwner && <TableHead>{t('mcp.colOwner')}</TableHead>}
            <TableHead>{t('mcp.colName')}</TableHead>
            <TableHead className="hidden sm:table-cell">{t('mcp.colKey')}</TableHead>
            <TableHead className="hidden md:table-cell">{t('mcp.colCreated')}</TableHead>
            <TableHead className="hidden lg:table-cell">{t('mcp.colLastUsed')}</TableHead>
            <TableHead>{t('mcp.expires')}</TableHead>
            <TableHead>{t('mcp.colStatus')}</TableHead>
            <TableHead aria-label={t('mcp.colActions')} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map(key => (
            <TableRow key={key.id} data-testid={`${testId}-row-${key.id}`}>
              {showOwner && <TableCell className="max-w-52 truncate">{(key as AdminMcpKey).owner.email}</TableCell>}
              <TableCell className="max-w-52 truncate font-medium">{key.name}</TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                {key.keySuffix ? `apm_••••${key.keySuffix}` : 'apm_••••'}
              </TableCell>
              <TableCell className="hidden md:table-cell">{formatDate(key.createdAt)}</TableCell>
              <TableCell className="hidden lg:table-cell">{key.lastUsedAt ? formatDate(key.lastUsedAt) : t('mcp.never')}</TableCell>
              <TableCell>{key.expiresAt ? formatDate(key.expiresAt) : t('mcp.neverExpires')}</TableCell>
              <TableCell><Badge variant={key.status === 'active' ? 'secondary' : 'outline'}>{t(`mcp.status.${key.status}`)}</Badge></TableCell>
              <TableCell className="text-right">
                {key.status === 'active' && (
                  <RevokeKeyDialog
                    name={key.name}
                    disabled={revokingId === key.id}
                    onConfirm={() => onRevoke(key)}
                    testId={`${testId}-revoke-${key.id}`}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function RevokeKeyDialog({ name, disabled, onConfirm, testId }: { name: string; disabled: boolean; onConfirm: () => void; testId: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" className="cursor-pointer text-destructive" disabled={disabled} onClick={() => setOpen(true)} data-testid={testId}>
        {t('mcp.revoke')}
      </Button>
      <DialogContent data-testid={`${testId}-dialog`}>
        <DialogHeader>
          <DialogTitle>{t('mcp.revokeTitle', { name })}</DialogTitle>
          <DialogDescription>{t('mcp.revokeDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); setOpen(false) }}>
            {t('mcp.revokeKey')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecretValue({ value, multiline = false, testId }: { value: string; multiline?: boolean; testId: string }) {
  const { t } = useTranslation()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }
  return (
    <FieldGroup className="gap-2 sm:flex-row sm:items-start">
      <FieldDescription
        className={`min-w-0 flex-1 rounded-md bg-muted p-3 font-mono text-foreground ${multiline ? 'whitespace-pre-wrap break-all' : 'break-all'}`}
        data-testid={testId}
      >
        {value}
      </FieldDescription>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => void copy()} aria-label={copyState === 'copied' ? t('common.copied') : t('common.copy')}>
        {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copyState === 'copied' ? t('common.copied') : copyState === 'failed' ? t('mcp.copyFailed') : t('common.copy')}
      </Button>
    </FieldGroup>
  )
}

function parseValidDays(value: string): McpKeyValidDays {
  if (value === 'never') return null
  const days = Number(value)
  return days === 30 || days === 90 || days === 365 ? days : 90
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
}
