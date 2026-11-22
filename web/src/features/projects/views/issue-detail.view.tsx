import { Layers, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ISSUE_DETAIL_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { EPIC_TEXT } from '@/features/projects/constants/epic-text.constants'
import type { useIssueDetailViewModel } from '@/features/projects/viewmodels/use-issue-detail.viewmodel'
import type { useStoryExtrasViewModel } from '@/features/projects/viewmodels/use-story-extras.viewmodel'
import { CodeChip, Notice } from '@/features/projects/views/planning-marks.view'
import { DesignNotice, StoryTabs } from '@/features/projects/views/story-parts.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Input } from '@/shared/components/primitives/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/primitives/sheet'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { SelectField } from '@/shared/components/select-field'
import { ErrorState } from '@/shared/components/state-views'

export type IssueDetailProps = ReturnType<typeof useIssueDetailViewModel>
type StoryExtras = ReturnType<typeof useStoryExtrasViewModel>

// The detail of one issue, whatever its type, in a sheet that opens from the backlog and the board.
export function IssueDetailView({
  vm,
  extras,
  onOpenEpic,
}: {
  vm: IssueDetailProps
  extras?: StoryExtras
  onOpenEpic?: (id: string) => void
}) {
  const { t } = useTranslation('planning')
  const issue = vm.issue
  return (
    <Sheet open={vm.isOpen} onOpenChange={(open) => !open && vm.close()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl" data-testid="issue-detail">
        <SheetHeader className="border-b border-border p-5 pr-12">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {issue && <CodeChip>{issue.key}</CodeChip>}
            <span>{issue?.title ?? t(ISSUE_DETAIL_TEXT.loading)}</span>
          </SheetTitle>
          <SheetDescription>{issue ? issue.typeLabel : t(ISSUE_DETAIL_TEXT.loading)}</SheetDescription>
        </SheetHeader>

        {vm.status === 'loading' && (
          <div className="grid gap-3 p-5" data-testid="issue-detail-loading">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {vm.status === 'error' && (
          <div className="p-5">
            <ErrorState
              testId="issue-detail-error"
              title={t(ISSUE_DETAIL_TEXT.error)}
              message={vm.error ?? ''}
              retryLabel={t(ISSUE_DETAIL_TEXT.retry)}
              onRetry={vm.onRetry}
            />
          </div>
        )}
        {vm.status === 'ready' && issue && (
          <div className="grid gap-5 p-5">
            {issue.outdated && <OutdatedNotice level={issue.outdated} canReview={issue.canReview} onReview={issue.markReviewed} />}
            {issue.opensEpicSpace && onOpenEpic && (
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                data-testid="issue-detail-open-epic"
                onClick={() => onOpenEpic(issue.id)}
              >
                <Layers data-icon="inline-start" />
                {t(EPIC_TEXT.open)}
              </Button>
            )}
            {vm.actionError && (
              <Alert variant="destructive" data-testid="issue-detail-action-error">
                <AlertDescription>{vm.actionError}</AlertDescription>
              </Alert>
            )}

            <Section title={t(ISSUE_DETAIL_TEXT.properties)}>
              <dl className="grid gap-2.5 text-sm">
                <Row label={t(ISSUE_DETAIL_TEXT.status)}>
                  {issue.canSetStatus ? (
                    <SelectField
                      size="sm"
                      className="w-40"
                      label={t(ISSUE_DETAIL_TEXT.status)}
                      testId="issue-detail-status"
                      value={issue.statusValue}
                      onValueChange={issue.setStatus}
                      options={issue.statusOptions}
                    />
                  ) : (
                    <Badge variant="secondary">{issue.statusLabel}</Badge>
                  )}
                </Row>
                {issue.showPoints && (
                  <Row label={t(ISSUE_DETAIL_TEXT.points)}>
                    {issue.canSetPoints ? (
                      <SelectField
                        size="sm"
                        className="w-40"
                        label={t(ISSUE_DETAIL_TEXT.points)}
                        testId="issue-detail-points"
                        value={issue.pointsValue}
                        onValueChange={issue.setPoints}
                        options={issue.pointsOptions}
                      />
                    ) : (
                      <span>{issue.pointsLabel}</span>
                    )}
                  </Row>
                )}
                <Row label={t(ISSUE_DETAIL_TEXT.priority)}>{issue.priorityLabel}</Row>
                <Row label={t(ISSUE_DETAIL_TEXT.assignee)}>{issue.assignee}</Row>
                <Row label={t(ISSUE_DETAIL_TEXT.parent)}>
                  {issue.parent ? (
                    <span className="flex items-center gap-1.5" data-testid="issue-detail-parent">
                      <CodeChip>{issue.parent.key}</CodeChip>
                      {issue.parent.title}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t(ISSUE_DETAIL_TEXT.noParent)}</span>
                  )}
                </Row>
                <Row label={t(ISSUE_DETAIL_TEXT.sprint)}>{issue.sprintLabel}</Row>
              </dl>
            </Section>

            {vm.storyRef && extras ? (
              <>
                {extras.available && <DesignNotice extras={extras} />}
                <StoryTabs extras={extras} description={issue.description} acceptance={issue.acceptance} />
              </>
            ) : (
              <>
                <Section title={t(ISSUE_DETAIL_TEXT.description)}>
                  <Text value={issue.description} empty={t(ISSUE_DETAIL_TEXT.noDescription)} testId="issue-detail-description" />
                </Section>
                <Section title={t(ISSUE_DETAIL_TEXT.acceptance)}>
                  <Text value={issue.acceptance} empty={t(ISSUE_DETAIL_TEXT.noAcceptance)} testId="issue-detail-acceptance" />
                </Section>
              </>
            )}

            {vm.ticket && <TicketSections ticket={vm.ticket} />}

            {vm.showChildren && (
              <Section title={vm.childrenHeading}>
                {vm.children.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t(ISSUE_DETAIL_TEXT.noChildren)}</p>
                ) : (
                  <ul className="grid divide-y divide-border rounded-lg border border-border">
                    {vm.children.rows.map((child) => (
                      <li
                        key={child.id}
                        data-testid={`issue-detail-child-${child.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                      >
                        <CodeChip>{child.key}</CodeChip>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto min-w-0 flex-1 justify-start p-0 text-foreground"
                          data-testid={`issue-detail-open-${child.id}`}
                          onClick={() => vm.open(child.id)}
                        >
                          <span className="truncate">{child.title}</span>
                        </Button>
                        {child.statusLabel && <Badge variant="secondary">{child.statusLabel}</Badge>}
                        <span className="text-xs text-muted-foreground">{child.assignee}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {vm.subtaskForm && (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      vm.subtaskForm?.add()
                    }}
                  >
                    <Input
                      data-testid="issue-detail-subtask-new"
                      aria-label={t(ISSUE_DETAIL_TEXT.subtaskAdd)}
                      placeholder={t(ISSUE_DETAIL_TEXT.subtaskAdd)}
                      value={vm.subtaskForm.value}
                      onChange={(event) => vm.subtaskForm?.setValue(event.target.value)}
                    />
                    <Button type="submit" size="sm" data-testid="issue-detail-subtask-add" disabled={!vm.subtaskForm.canAdd}>
                      {t(ISSUE_DETAIL_TEXT.subtaskAddButton)}
                    </Button>
                  </form>
                )}
                <LoadMoreButton
                  hasMore={vm.children.hasMore}
                  isLoading={vm.children.isLoadingMore}
                  onLoadMore={vm.children.onLoadMore}
                  testId="issue-detail-children-more"
                />
              </Section>
            )}

            <Section title={t(ISSUE_DETAIL_TEXT.checklist)} aside={vm.checklist.items.length > 0 ? vm.checklist.progress : undefined}>
              {vm.checklist.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(ISSUE_DETAIL_TEXT.noChecklist)}</p>
              ) : (
                <ul className="grid gap-1">
                  {vm.checklist.items.map((item) => (
                    <li key={item.id} data-testid={`issue-detail-check-${item.id}`} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={item.done}
                        disabled={!vm.checklist.canEdit}
                        aria-label={t(ISSUE_DETAIL_TEXT.checklistTick, { title: item.title })}
                        data-testid={`issue-detail-tick-${item.id}`}
                        onChange={(event) => vm.checklist.toggle(item.id, event.target.checked)}
                      />
                      <span className={item.done ? 'min-w-0 flex-1 text-muted-foreground line-through' : 'min-w-0 flex-1'}>
                        {item.title}
                      </span>
                      {vm.checklist.canEdit && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={t(ISSUE_DETAIL_TEXT.checklistDelete, { title: item.title })}
                          data-testid={`issue-detail-delete-${item.id}`}
                          onClick={() => vm.checklist.remove(item.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {vm.checklist.canEdit && (
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    vm.checklist.add()
                  }}
                >
                  <Input
                    data-testid="issue-detail-check-new"
                    aria-label={t(ISSUE_DETAIL_TEXT.checklistAdd)}
                    placeholder={t(ISSUE_DETAIL_TEXT.checklistAdd)}
                    value={vm.checklist.newItem}
                    onChange={(event) => vm.checklist.setNewItem(event.target.value)}
                  />
                  <Button type="submit" size="sm" data-testid="issue-detail-check-add" disabled={!vm.checklist.canAdd}>
                    {t(ISSUE_DETAIL_TEXT.checklistAddButton)}
                  </Button>
                </form>
              )}
            </Section>

            <Section title={t(ISSUE_DETAIL_TEXT.links)}>
              {vm.links.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(ISSUE_DETAIL_TEXT.noLinks)}</p>
              ) : (
                <ul className="grid gap-1.5">
                  {vm.links.map((link) => (
                    <li key={link.id} data-testid={`issue-detail-link-${link.id}`} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{link.label}</span>
                      <CodeChip>{link.key}</CodeChip>
                      <span className="truncate">{link.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function OutdatedNotice({ level, canReview, onReview }: { level: 'plain' | 'sprint'; canReview: boolean; onReview: () => void }) {
  const { t } = useTranslation('planning')
  const text = t(level === 'sprint' ? ISSUE_DETAIL_TEXT.outdatedSprint : ISSUE_DETAIL_TEXT.outdated)
  const review = canReview && (
    <Button size="xs" variant="outline" className="w-fit" data-testid="issue-detail-reviewed" onClick={onReview}>
      {t(ISSUE_DETAIL_TEXT.markReviewed)}
    </Button>
  )
  if (level === 'sprint') {
    return (
      <Alert variant="destructive" data-testid="issue-detail-outdated">
        <AlertDescription className="grid gap-2">
          {text}
          {review}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Notice tone="warning" testId="issue-detail-outdated">
      <span className="grid gap-2">
        {text}
        {review}
      </span>
    </Notice>
  )
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="flex items-baseline justify-between font-heading text-[13px] font-semibold tracking-tight">
        {title}
        {aside && <span className="text-xs font-normal text-muted-foreground">{aside}</span>}
      </h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Text({ value, empty, testId }: { value: string; empty: string; testId: string }) {
  return value.trim() === '' ? (
    <p className="text-sm text-muted-foreground">{empty}</p>
  ) : (
    <p className="max-w-[68ch] whitespace-pre-wrap text-sm leading-7" data-testid={testId}>
      {value}
    </p>
  )
}

type TicketPanel = NonNullable<IssueDetailProps['ticket']>

// CLOUD-001: the ticket fields, its Definition of Ready, and the acceptance criteria it delivers.
function TicketSections({ ticket }: { ticket: TicketPanel }) {
  const { t } = useTranslation('planning')
  return (
    <>
      <Section title={t(ISSUE_DETAIL_TEXT.readiness)} aside={ticket.readyLabel}>
        <div className="grid gap-2" data-testid="issue-detail-readiness">
          <Badge variant={ticket.ready ? 'success' : 'warning'}>{ticket.readyLabel}</Badge>
          {ticket.failing.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {ticket.failing.map((miss) => (
                <li key={miss.id} className="grid gap-0.5" data-testid={`issue-detail-readiness-${miss.id}`}>
                  <span className="font-medium text-warning">{miss.label}</span>
                  <span className="text-xs text-muted-foreground">{miss.rule}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title={t(ISSUE_DETAIL_TEXT.ticket)} aside={ticket.code}>
        <dl className="grid gap-2 text-sm" data-testid="issue-detail-ticket">
          {ticket.fields.map((field) => (
            <div key={field.id} className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="whitespace-pre-wrap">{field.value}</dd>
            </div>
          ))}
        </dl>
        {ticket.checks.length > 0 && (
          <div className="grid gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">{t(ISSUE_DETAIL_TEXT.ticketChecks)}</h4>
            {ticket.checks.map((check) => (
              <GivenWhenThen
                key={check.id}
                given={check.given}
                when={check.when}
                outcomes={check.outcomes}
                testId={`issue-detail-check-${check.id}`}
              />
            ))}
          </div>
        )}
        {ticket.tests.length > 0 && (
          <div className="grid gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">{t(ISSUE_DETAIL_TEXT.requiredTests)}</h4>
            <ul className="grid gap-1 text-sm">
              {ticket.tests.map((test) => (
                <li key={test.id} className="flex items-center gap-2" data-testid={`issue-detail-test-${test.id}`}>
                  <span>{test.label}</span>
                  {test.unhappy && <Badge variant="warning">{t(ISSUE_DETAIL_TEXT.unhappy)}</Badge>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={t(ISSUE_DETAIL_TEXT.delivers)}>
        {ticket.criteria.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(ISSUE_DETAIL_TEXT.noCriteria)}</p>
        ) : (
          <div className="grid gap-2">
            {ticket.criteria.map((criterion) => (
              <div key={criterion.id} className="grid gap-1" data-testid={`issue-detail-criterion-${criterion.id}`}>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CodeChip>{criterion.code}</CodeChip>
                  <span className={criterion.struck ? 'text-muted-foreground line-through' : undefined}>{criterion.title}</span>
                  {criterion.struck && <Badge variant="destructive">{t(ISSUE_DETAIL_TEXT.struck)}</Badge>}
                </span>
                {!criterion.struck && (
                  <GivenWhenThen
                    given={criterion.given}
                    when={criterion.when}
                    outcomes={criterion.outcomes}
                    testId={`issue-detail-gwt-${criterion.id}`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}

export function GivenWhenThen({ given, when, outcomes, testId }: { given: string; when: string; outcomes: string[]; testId: string }) {
  const { t } = useTranslation('planning')
  return (
    <dl className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm" data-testid={testId}>
      <dt className="text-[11px] font-semibold text-muted-foreground uppercase">{t(ISSUE_DETAIL_TEXT.given)}</dt>
      <dd>{given}</dd>
      <dt className="text-[11px] font-semibold text-muted-foreground uppercase">{t(ISSUE_DETAIL_TEXT.when)}</dt>
      <dd>{when}</dd>
      <dt className="text-[11px] font-semibold text-muted-foreground uppercase">{t(ISSUE_DETAIL_TEXT.thenLabel)}</dt>
      <dd>
        <ul className="list-disc pl-4">
          {outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </dd>
    </dl>
  )
}
