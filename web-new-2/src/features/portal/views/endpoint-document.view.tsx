import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { ReactNode } from 'react'
import type { ApiNode, RequestBodyField, ResponseExample } from '../models/portal.model'
import { authenticationLabel, methodLabelClass, requestBodyMode, requestBodyModeLabel, responseStatusBadgeClass, visibleKeyValueRows } from '../utils/request-documentation.utils'
import { isSensitiveName, MASKED_VALUE, redactText } from '../utils/documentation-redaction'
import { EmptyView } from './state.view'

export function EndpointDocumentView({ request }: { request: ApiNode }) {
  const { t } = useTranslation()
  const responses = request.responses ?? []
  const pathParams = visibleKeyValueRows(request.pathParams)
  const queryParams = visibleKeyValueRows(request.params, true)
  const headers = visibleKeyValueRows(request.headers, true)
  const bodyMode = requestBodyMode(request)

  return (
    <Card
      key={request.id}
      data-testid="collection-detail-container"
      className="min-w-0 gap-0 rounded-lg shadow-none"
    >
      <CardHeader className="gap-3">
        <FieldGroup className="flex-row flex-wrap items-center gap-2">
          <CardDescription className={`text-xs font-medium ${methodLabelClass(request.method ?? 'GET')}`}>
            {request.method ?? 'GET'}
          </CardDescription>
          <CardTitle role="heading" aria-level={2} className="min-w-0 break-words text-base">
            {request.name}
          </CardTitle>
          {request.deprecated && <Badge variant="destructive">{t('endpoint.deprecated')}</Badge>}
        </FieldGroup>
        <CardDescription className="break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground">
          {redactText(request.url ?? t('endpoint.noUrl'))}
        </CardDescription>
        <CardDescription className="break-words text-xs leading-5">
          {t('endpoint.summary', {
            auth: authenticationLabel(t, request.auth),
            path: pathParams.length,
            query: queryParams.length,
            headers: headers.length,
            body: requestBodyModeLabel(t, bodyMode),
            responses: responses.length,
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        <Tabs defaultValue="request" className="gap-4" data-testid="collection-detail-tabs">
          <TabsList variant="line" aria-label={t('endpoint.sectionsAria')}>
            <TabsTrigger value="request" data-testid="collection-request-tab">
              {t('endpoint.tabRequest')}
            </TabsTrigger>
            <TabsTrigger value="responses" data-testid="collection-responses-tab">
              {t('endpoint.tabResponses', { count: responses.length })}
            </TabsTrigger>
            <TabsTrigger value="documentation" data-testid="collection-documentation-tab">
              {t('endpoint.tabDocumentation')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="pt-1" data-testid="collection-request-content">
            <FieldGroup className="gap-3">
              <ContractSection title={t('endpoint.pathParams')} rows={pathParams} />
              <ContractSection title={t('endpoint.queryParams')} rows={queryParams} />
              <ContractSection title={t('endpoint.headers')} rows={headers} />
              <AuthenticationSection request={request} />
              <RequestBodySection request={request} mode={bodyMode} />
            </FieldGroup>
          </TabsContent>

          <TabsContent value="responses" className="pt-1" data-testid="collection-responses-content">
            {responses.length ? (
              <FieldGroup className="gap-3">
                {responses.map(response => <ResponseCard key={response.id} response={response} />)}
              </FieldGroup>
            ) : (
              <EmptyView
                title={t('endpoint.noResponses')}
                description={t('endpoint.noResponsesDescription')}
              />
            )}
          </TabsContent>

          <TabsContent value="documentation" className="pt-1" data-testid="collection-documentation-content">
            <FieldGroup className="gap-3">
              <DetailSection title={t('endpoint.description')}>
                <CardDescription role="status" className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {request.documentation?.trim()
                    ? redactText(request.documentation ?? '')
                    : t('endpoint.noDocumentation')}
                </CardDescription>
              </DetailSection>
              {request.deprecated && (
                <DetailSection title={t('endpoint.deprecationNotice')}>
                  <CardDescription className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {request.deprecationReason?.trim()
                      ? redactText(request.deprecationReason ?? '')
                      : t('endpoint.deprecatedDefault')}
                  </CardDescription>
                </DetailSection>
              )}
            </FieldGroup>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function DetailSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <FieldGroup className="min-w-0 gap-3 border-t border-border pt-5">
      <FieldGroup className="flex-row items-center justify-between gap-3">
        <FieldTitle className="text-base">{title}</FieldTitle>
        {count !== undefined && <Badge variant="outline">{count}</Badge>}
      </FieldGroup>
      {children}
    </FieldGroup>
  )
}

function ContractSection({ title, rows }: { title: string; rows: ReturnType<typeof visibleKeyValueRows> }) {
  const { t } = useTranslation()
  return (
    <DetailSection title={title} count={rows.length}>
      {rows.length ? (
        <Table aria-label={title}>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2">{t('endpoint.colName')}</TableHead>
              <TableHead>{t('endpoint.colExample')}</TableHead>
              <TableHead>{t('endpoint.description')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="max-w-48 whitespace-normal break-words px-2 font-mono text-xs">
                  {row.name}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal break-all font-mono text-xs">
                  {isSensitiveName(row.name) ? MASKED_VALUE : row.value || t('endpoint.notSet')}
                </TableCell>
                <TableCell className="min-w-32 whitespace-normal break-words text-muted-foreground">
                  {row.description || t('endpoint.noDescription')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <FieldDescription role="status">{t('endpoint.noneSaved', { section: title.toLowerCase() })}</FieldDescription>
      )}
    </DetailSection>
  )
}

function AuthenticationSection({ request }: { request: ApiNode }) {
  const { t } = useTranslation()
  const auth = request.auth ?? { type: 'none' as const }
  return (
    <DetailSection title={t('endpoint.authentication')}>
      <FieldGroup className="gap-2">
        <FieldDescription className="font-medium text-foreground">
          {authenticationLabel(t, auth)}
        </FieldDescription>
        <FieldDescription className="max-w-prose whitespace-normal">
          {auth.type === 'none'
            ? t('endpoint.authNone')
            : t('endpoint.authHidden')}
        </FieldDescription>
      </FieldGroup>
    </DetailSection>
  )
}

function RequestBodySection({ request, mode }: { request: ApiNode; mode: string }) {
  const { t } = useTranslation()
  return (
    <DetailSection title={t('endpoint.requestBody')}>
      <FieldGroup className="gap-3">
        <FieldDescription className="font-medium text-foreground">{requestBodyModeLabel(t, mode)}</FieldDescription>
        <RequestBody request={request} mode={mode} />
      </FieldGroup>
    </DetailSection>
  )
}

function RequestBody({ request, mode }: { request: ApiNode; mode: string }) {
  const { t } = useTranslation()
  if (mode === 'none') {
    return <FieldDescription role="status">{t('endpoint.noBody')}</FieldDescription>
  }

  if (mode === 'file') {
    return (
      <FieldDescription>
        {t('body.file')}{request.bodyMimeType ? ` · ${request.bodyMimeType}` : ''}
      </FieldDescription>
    )
  }

  if (mode === 'form-data' || mode === 'multipart/form-data' || mode === 'urlencoded' || mode === 'x-www-form-urlencoded') {
    const fields = (request.bodyFields ?? []).filter(field => field.enabled && field.name.trim())
    return fields.length ? (
      <BodyFieldsTable fields={fields} />
    ) : (
      <FieldDescription role="status">{t('endpoint.noBodyFields')}</FieldDescription>
    )
  }

  if (mode === 'graphql') {
    return (
      <FieldGroup className="gap-3">
        <CodePanel label={t('endpoint.graphqlQuery')} value={request.body ?? ''} testId="collection-body-input" />
        <CodePanel label={t('endpoint.variables')} value={request.bodyVariables || '{}'} testId="collection-body-variables-input" />
      </FieldGroup>
    )
  }

  return (
    <CodePanel
      label={request.bodyMimeType || t('endpoint.modeExample', { mode: requestBodyModeLabel(t, mode) })}
      value={request.body ?? ''}
      testId="collection-body-input"
    />
  )
}

function BodyFieldsTable({ fields }: { fields: RequestBodyField[] }) {
  const { t } = useTranslation()
  return (
    <Table aria-label={t('endpoint.bodyFieldsAria')}>
      <TableHeader>
        <TableRow>
          <TableHead className="px-2">{t('endpoint.colName')}</TableHead>
          <TableHead>{t('endpoint.colExample')}</TableHead>
          <TableHead>{t('endpoint.colType')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map(field => (
          <TableRow key={field.id}>
            <TableCell className="whitespace-normal break-words px-2 font-mono text-xs">{field.name}</TableCell>
            <TableCell className="whitespace-normal break-all font-mono text-xs">
              {isSensitiveName(field.name)
                ? MASKED_VALUE
                : field.type === 'file'
                  ? field.fileName || t('body.file')
                  : field.value || t('endpoint.notSet')}
            </TableCell>
            <TableCell className="text-muted-foreground">{field.type}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ResponseCard({ response }: { response: ResponseExample }) {
  const { t } = useTranslation()
  const content = response.content ?? []
  return (
    <DetailSection title={t('endpoint.response')} count={content.length}>
      <FieldGroup className="gap-3">
        <FieldGroup className="flex-row flex-wrap items-center gap-2">
          <Badge variant="outline" className={responseStatusBadgeClass(response.statusCode)}>
            {response.statusCode || t('endpoint.statusNotSet')}
          </Badge>
          {response.description && <FieldDescription>{response.description}</FieldDescription>}
        </FieldGroup>
        {content.length ? content.map(item => (
          <FieldGroup key={item.id} className="gap-3">
            <FieldTitle className="text-xs font-medium">{item.mediaType || t('endpoint.responseBody')}</FieldTitle>
            {item.schema.trim() && <CodePanel label={t('endpoint.schema')} value={item.schema} />}
            {item.example.trim() && <CodePanel label={t('endpoint.example')} value={item.example} testId={`collection-response-example-${item.id}`} />}
            {!item.schema.trim() && !item.example.trim() && (
              <FieldDescription>{t('endpoint.noSchemaExample')}</FieldDescription>
            )}
          </FieldGroup>
        )) : (
          <FieldDescription role="status">{t('endpoint.noBodyExample')}</FieldDescription>
        )}
      </FieldGroup>
    </DetailSection>
  )
}

function CodePanel({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <FieldGroup className="gap-1.5">
      <FieldDescription className="text-xs">{label}</FieldDescription>
      {/* Long bodies scroll inside the panel. The textarea grows with its content, so the scroll area does the scrolling. */}
      <ScrollArea viewportClassName="max-h-96 rounded-md">
        <Textarea
          aria-label={label}
          data-testid={testId}
          readOnly
          spellCheck={false}
          value={redactText(value)}
          className="min-h-24 resize-none bg-background font-mono text-xs leading-relaxed"
        />
      </ScrollArea>
    </FieldGroup>
  )
}
