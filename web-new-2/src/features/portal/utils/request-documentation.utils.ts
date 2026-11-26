import type { ApiNode, KeyValueRow, RequestAuth } from '../models/portal.model'
import type { TFunction } from 'i18next'

export function methodLabelClass(method?: string): string {
  switch (method?.toUpperCase()) {
    case 'GET':
      return 'text-success'
    case 'POST':
      return 'text-info'
    case 'PUT':
    case 'PATCH':
      return 'text-warning'
    case 'DELETE':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

export function responseStatusBadgeClass(statusCode: string): string {
  if (/^2\d\d/.test(statusCode)) return 'border-success/20 bg-success/10 text-success'
  if (/^3\d\d/.test(statusCode)) return 'border-warning/20 bg-warning/10 text-warning'
  if (/^[45]\d\d/.test(statusCode)) return 'border-destructive/20 bg-destructive/10 text-destructive'
  return 'border-border bg-secondary text-secondary-foreground'
}

export function requestBodyMode(request: ApiNode): string {
  return request.bodyMode?.trim().toLowerCase() || (request.body?.trim() ? 'json' : 'none')
}

export function requestBodyModeLabel(t: TFunction, mode: string): string {
  const labels: Record<string, string> = {
    none: t('body.none'),
    json: 'JSON',
    raw: t('body.raw'),
    'form-data': t('body.multipart'),
    'multipart/form-data': t('body.multipart'),
    urlencoded: t('body.urlencoded'),
    'x-www-form-urlencoded': t('body.urlencoded'),
    graphql: 'GraphQL',
    file: t('body.file'),
  }
  return labels[mode] ?? mode
}

export function authenticationLabel(t: TFunction, auth?: RequestAuth): string {
  if (!auth || auth.type === 'none') return t('auth.none')
  if (auth.type === 'bearer') return t('auth.bearer')
  if (auth.type === 'basic') return t('auth.basic')
  return t('auth.apiKey', { location: auth.location })
}

export function visibleKeyValueRows(rows?: KeyValueRow[], enabledOnly = false): KeyValueRow[] {
  return (rows ?? []).filter(row => (!enabledOnly || row.enabled) && row.name.trim())
}
