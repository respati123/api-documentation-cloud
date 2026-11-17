import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/shared/components/copy-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Card } from '@/shared/components/primitives/card'
import { ScrollArea } from '@/shared/components/primitives/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/primitives/tabs'
import type { KeyValueRow, RequestNode } from '@/shared/models/cloud-workspace.model'
import { DOCS_BODY_TEXT, DOCS_TEXT } from '../constants/docs-text.constants'
import { isSensitiveName, MASKED_VALUE, redactText } from '../utils/redact'
import { methodVariant } from './method-badge'

// Underline tabs, the same style as the workspace tabs above.
const tabTriggerClass =
  'h-10 flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground data-active:border-primary data-active:bg-transparent data-active:text-foreground'

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
  const description = request.documentation?.trim()

  return (
    <article data-testid="docs-endpoint" className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{request.name}</h2>
          {request.deprecated && <Badge variant="destructive">{t(DOCS_TEXT.endpoint.deprecated)}</Badge>}
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card p-1.5 pl-2">
          <Badge variant={methodVariant(request.method)} className="w-16 shrink-0 justify-center font-mono">
            {request.method.toUpperCase()}
          </Badge>
          <code className="min-w-0 flex-1 truncate font-mono text-sm">{request.url || t(DOCS_TEXT.endpoint.noUrl)}</code>
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

        <p className={description ? 'max-w-3xl text-sm text-foreground' : 'text-sm text-muted-foreground'}>
          {description || t(DOCS_TEXT.endpoint.noDescription)}
        </p>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Fact label={t(DOCS_TEXT.endpoint.authentication)} value={authLabel} />
          <Fact label={t(DOCS_TEXT.endpoint.body)} value={bodyName(bodyMode, t)} />
          <Fact label={t(DOCS_TEXT.endpoint.responses)} value={t(DOCS_TEXT.endpoint.responsesCount, { count: responses.length })} />
        </dl>
      </header>

      <Tabs defaultValue="request">
        <TabsList
          variant="line"
          aria-label={t(DOCS_TEXT.endpoint.sectionsLabel)}
          className="h-auto w-full justify-start gap-1 rounded-none border-b border-border p-0"
        >
          <TabsTrigger value="request" className={tabTriggerClass}>
            {t(DOCS_TEXT.endpoint.tabRequest)}
          </TabsTrigger>
          <TabsTrigger value="responses" className={tabTriggerClass}>
            {t(DOCS_TEXT.endpoint.tabResponses)}
            <Badge variant="outline">{responses.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="pt-4">
          <Card className="gap-0 py-0">
            <ContractSection title={t(DOCS_TEXT.contract.pathParams)} rows={visibleRows(request.pathParams)} />
            <ContractSection title={t(DOCS_TEXT.contract.queryParams)} rows={visibleRows(request.params, true)} />
            <ContractSection title={t(DOCS_TEXT.contract.headers)} rows={visibleRows(request.headers, true)} />
            <Section title={t(DOCS_TEXT.endpoint.authentication)} meta={authLabel}>
              <p className="text-sm text-muted-foreground">
                {auth.type === 'none' ? t(DOCS_TEXT.auth.noneNote) : t(DOCS_TEXT.auth.hiddenNote)}
              </p>
            </Section>
            <Section title={t(DOCS_TEXT.contract.requestBody)} meta={bodyName(bodyMode, t)}>
              <RequestBody request={request} mode={bodyMode} />
            </Section>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="pt-4">
          {responses.length === 0 ? (
            <Card className="gap-1 px-4 py-4">
              <p className="text-sm font-medium">{t(DOCS_TEXT.responses.emptyTitle)}</p>
              <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.responses.emptyDetail)}</p>
            </Card>
          ) : (
            <Card className="gap-0 py-0">
              {responses.map((response) => (
                <section key={response.id} className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={/^[45]/.test(response.statusCode) ? 'destructive' : 'secondary'} className="font-mono">
                      {response.statusCode || t(DOCS_TEXT.responses.status)}
                    </Badge>
                    <p className="text-sm">{response.description || t(DOCS_TEXT.responses.description)}</p>
                  </div>
                  {response.content.length === 0 && <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.responses.noBody)}</p>}
                  {response.content.map((content) => (
                    <div key={content.id} className="grid gap-2">
                      <p className="font-mono text-xs text-muted-foreground">{content.mediaType || t(DOCS_TEXT.responses.bodyTitle)}</p>
                      {content.schema.trim() && <CodePanel label={t(DOCS_TEXT.responses.schema)} value={content.schema} />}
                      {content.example.trim() && <CodePanel label={t(DOCS_TEXT.responses.example)} value={redactText(content.example)} />}
                      {!content.schema.trim() && !content.example.trim() && (
                        <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.responses.noSchemaExample)}</p>
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

// One block of the request contract inside the shared card. The count sits next to the title.
function Section({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {meta !== undefined && <span className="text-sm text-muted-foreground">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

function ContractSection({ title, rows }: { title: string; rows: Array<KeyValueRow> }) {
  const { t } = useTranslation('docs')
  return (
    <Section title={title} meta={<Badge variant="outline">{rows.length}</Badge>}>
      {rows.length ? (
        <ScrollArea className="w-full">
          <Table aria-label={title}>
            <TableHeader>
              <TableRow>
                <TableHead className="px-0">{t(DOCS_TEXT.contract.name)}</TableHead>
                <TableHead>{t(DOCS_TEXT.contract.example)}</TableHead>
                <TableHead>{t(DOCS_TEXT.contract.description)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-transparent">
                  <TableCell className="px-0">
                    <code className="font-mono text-xs">{row.name}</code>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {isSensitiveName(row.name) ? MASKED_VALUE : row.value || t(DOCS_TEXT.contract.notSet)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.description || t(DOCS_TEXT.contract.noDescription)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      ) : (
        <p className="text-sm text-muted-foreground">{t(DOCS_TEXT.contract.none)}</p>
      )}
    </Section>
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
            <TableRow key={field.id} className="hover:bg-transparent">
              <TableCell className="px-0">
                <code className="font-mono text-xs">{field.name}</code>
              </TableCell>
              <TableCell className="font-mono text-xs">
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
      <ScrollArea className="max-h-80 rounded-lg border border-border bg-muted/50">
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
