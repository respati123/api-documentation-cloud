import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/shared/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import type { KeyValueRow, RequestNode } from '@/shared/models/cloud-workspace.model'
import { DOCS_BODY_TEXT, DOCS_TEXT } from '../constants/docs-text.constants'
import { isSensitiveName, MASKED_VALUE, redactText } from '../utils/redact'
import { methodVariant } from './method-badge'

export function EndpointDocumentView({ request }: { request: RequestNode }) {
  const { t } = useTranslation('docs')
  const auth = request.auth ?? { type: 'none' as const }
  const authLabel =
    auth.type === 'none'
      ? t(DOCS_TEXT.auth.none)
      : auth.type === 'bearer'
        ? t(DOCS_TEXT.auth.bearer)
        : auth.type === 'basic'
          ? t(DOCS_TEXT.auth.basic)
          : t(DOCS_TEXT.auth.apiKey, { location: auth.location })
  const bodyMode = request.bodyMode || (request.body.trim() ? 'json' : 'none')
  const responses = request.responses ?? []

  return (
    <article data-testid="docs-endpoint" className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={methodVariant(request.method)} className="font-mono">
              {request.method}
            </Badge>
            <CardTitle className="text-xl">{request.name}</CardTitle>
            {request.deprecated && <Badge variant="destructive">{t(DOCS_TEXT.endpoint.deprecated)}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-sm">
              {request.url || t(DOCS_TEXT.endpoint.noUrl)}
            </code>
            <CopyButton
              value={request.url}
              label={t(DOCS_TEXT.endpoint.copyUrl)}
              copiedLabel={t(DOCS_TEXT.endpoint.copied)}
              ariaLabel={t(DOCS_TEXT.endpoint.copyLabel)}
              testId="docs-copy-url-button"
            />
          </div>
          {request.deprecated && request.deprecationReason && (
            <Alert>
              <AlertDescription>{request.deprecationReason}</AlertDescription>
            </Alert>
          )}
          <CardDescription>{request.documentation?.trim() ? request.documentation : t(DOCS_TEXT.endpoint.noDescription)}</CardDescription>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Fact label={t(DOCS_TEXT.endpoint.authentication)} value={authLabel} />
            <Fact label={t(DOCS_TEXT.endpoint.body)} value={bodyName(bodyMode, t)} />
            <Fact label={t(DOCS_TEXT.endpoint.responses)} value={t(DOCS_TEXT.endpoint.responsesCount, { count: responses.length })} />
          </dl>
        </CardHeader>
      </Card>

      <Tabs defaultValue="request">
        <TabsList aria-label={t(DOCS_TEXT.endpoint.sectionsLabel)}>
          <TabsTrigger value="request">{t(DOCS_TEXT.endpoint.tabRequest)}</TabsTrigger>
          <TabsTrigger value="responses">
            {t(DOCS_TEXT.endpoint.tabResponses)}
            <Badge variant="outline">{responses.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="grid gap-4">
          <ContractTable title={t(DOCS_TEXT.contract.pathParams)} rows={visibleRows(request.pathParams)} />
          <ContractTable title={t(DOCS_TEXT.contract.queryParams)} rows={visibleRows(request.params, true)} />
          <ContractTable title={t(DOCS_TEXT.contract.headers)} rows={visibleRows(request.headers, true)} />
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t(DOCS_TEXT.endpoint.authentication)}</CardTitle>
              <CardDescription>{authLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {auth.type === 'none' ? t(DOCS_TEXT.auth.noneNote) : t(DOCS_TEXT.auth.hiddenNote)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t(DOCS_TEXT.contract.requestBody)}</CardTitle>
              <CardDescription>{bodyName(bodyMode, t)}</CardDescription>
            </CardHeader>
            <CardContent>
              <RequestBody request={request} mode={bodyMode} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="responses" className="grid gap-4">
          {responses.length === 0 ? (
            <Alert>
              <AlertTitle>{t(DOCS_TEXT.responses.emptyTitle)}</AlertTitle>
              <AlertDescription>{t(DOCS_TEXT.responses.emptyDetail)}</AlertDescription>
            </Alert>
          ) : (
            responses.map((response) => (
              <Card key={response.id} size="sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Badge variant={/^[45]/.test(response.statusCode) ? 'destructive' : 'secondary'} className="font-mono">
                      {response.statusCode || t(DOCS_TEXT.responses.status)}
                    </Badge>
                    <CardDescription>{response.description || t(DOCS_TEXT.responses.description)}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {response.content.length === 0 && <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.responses.noBody)}</p>}
                  {response.content.map((content) => (
                    <div key={content.id} className="grid gap-2">
                      <p className="text-sm font-medium">{content.mediaType || t(DOCS_TEXT.responses.bodyTitle)}</p>
                      {content.schema.trim() && <CodePanel label={t(DOCS_TEXT.responses.schema)} value={content.schema} />}
                      {content.example.trim() && <CodePanel label={t(DOCS_TEXT.responses.example)} value={redactText(content.example)} />}
                      {!content.schema.trim() && !content.example.trim() && (
                        <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.responses.noSchemaExample)}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function ContractTable({ title, rows }: { title: string; rows: Array<KeyValueRow> }) {
  const { t } = useTranslation('docs')
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ScrollArea className="w-full">
            <Table aria-label={title}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(DOCS_TEXT.contract.name)}</TableHead>
                  <TableHead>{t(DOCS_TEXT.contract.example)}</TableHead>
                  <TableHead>{t(DOCS_TEXT.contract.description)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <code>{row.name}</code>
                    </TableCell>
                    <TableCell>{isSensitiveName(row.name) ? MASKED_VALUE : row.value || t(DOCS_TEXT.contract.notSet)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.description || t(DOCS_TEXT.contract.noDescription)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.contract.none)}</p>
        )}
      </CardContent>
    </Card>
  )
}

function RequestBody({ request, mode }: { request: RequestNode; mode: string }) {
  const { t } = useTranslation('docs')
  if (mode === 'none') return <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.contract.noBody)}</p>
  if (mode === 'form-data' || mode === 'urlencoded') {
    const fields = (request.bodyFields ?? []).filter((field) => field.enabled && field.name.trim())
    if (!fields.length) return <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.contract.noFields)}</p>
    return (
      <Table>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.id}>
              <TableCell>
                <code>{field.name}</code>
              </TableCell>
              <TableCell>
                {isSensitiveName(field.name)
                  ? MASKED_VALUE
                  : field.type === 'file'
                    ? field.fileName || t(DOCS_TEXT.contract.file)
                    : field.value || t(DOCS_TEXT.contract.notSet)}
              </TableCell>
              <TableCell className="text-muted-foreground">{field.type}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  if (mode === 'file') {
    return (
      <p className="text-sm text-muted-foreground">
        {t(DOCS_TEXT.contract.fileUpload, { type: request.bodyMimeType || 'application/octet-stream' })}
      </p>
    )
  }
  if (mode === 'graphql') {
    return (
      <div className="grid gap-3">
        <CodePanel label={t(DOCS_TEXT.contract.graphqlQuery)} value={redactText(request.body)} />
        <CodePanel label={t(DOCS_TEXT.contract.variables)} value={redactText(request.bodyVariables || '{}')} />
      </div>
    )
  }
  return <CodePanel label={t(DOCS_TEXT.contract.exampleLabel, { name: bodyName(mode, t) })} value={redactText(request.body)} />
}

function CodePanel({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('docs')
  return (
    <div className="grid gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <ScrollArea className="max-h-80 rounded-md border border-border bg-muted/40">
        <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{value || t(DOCS_TEXT.contract.noExample)}</pre>
      </ScrollArea>
    </div>
  )
}

// Shows enabled rows with a name. Path parameters are always listed, so they skip the enabled check.
function visibleRows(rows: KeyValueRow[] | undefined, onlyEnabled = false): KeyValueRow[] {
  return (rows ?? []).filter((row) => (!onlyEnabled || row.enabled) && row.name.trim())
}

function bodyName(mode: string, t: (key: string) => string): string {
  const key = DOCS_BODY_TEXT[mode]
  return key ? t(key) : mode
}
