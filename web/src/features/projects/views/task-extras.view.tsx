import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { useTaskExtrasViewModel } from '@/features/projects/viewmodels/use-task-extras.viewmodel'
import { CodeChip, Notice, ProgressBar, RoleTag, StatusIcon } from '@/features/projects/views/planning-marks.view'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { cn } from '@/shared/utils/cn'

type Extras = ReturnType<typeof useTaskExtrasViewModel>

export function TaskSubtasks({ extras, canEdit }: { extras: Extras; canEdit: boolean }) {
  const { t } = useTranslation('planning')
  if (!extras.available) return null
  return (
    <section className="grid gap-2" data-testid="task-subtasks">
      {extras.locked && (
        <Notice tone="warning" testId="task-locked">
          <span className="flex items-center gap-2 text-sm">
            <Lock className="size-3.5" />
            {t(PLANNING_TEXT.task.lockedDetail)}
          </span>
        </Notice>
      )}
      <div className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
        <span>{t(PLANNING_TEXT.task.subtasks)}</span>
        <span className="tabular-nums">
          {extras.subtaskDone}/{extras.subtaskTotal}
        </span>
      </div>
      <ProgressBar percent={extras.subtaskPercent} />
      {extras.subtasks.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">{t(PLANNING_TEXT.task.noSubtasks)}</p>
      ) : (
        <ul className="grid">
          {extras.subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 border-b border-dashed border-border py-2 last:border-b-0"
            >
              <Label
                className={cn(
                  'items-start font-normal',
                  subtask.done && 'text-muted-foreground line-through decoration-muted-foreground/60',
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  data-testid={`task-subtask-${subtask.id}`}
                  checked={subtask.done}
                  disabled={!canEdit}
                  onChange={(event) => extras.onToggleSubtask(subtask.id, event.target.checked)}
                />
                {subtask.title}
              </Label>
              <span className="text-xs text-muted-foreground">{subtask.assigneeEmail?.split('@')[0]}</span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <Input
            aria-label={t(PLANNING_TEXT.task.subtaskPlaceholder)}
            placeholder={t(PLANNING_TEXT.task.subtaskPlaceholder)}
            data-testid="task-subtask-title"
            value={extras.newSubtask}
            onChange={(event) => extras.setNewSubtask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (extras.canAddSubtask) extras.onAddSubtask()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            data-testid="task-subtask-add"
            disabled={!extras.canAddSubtask}
            onClick={extras.onAddSubtask}
          >
            {t(PLANNING_TEXT.task.addSubtask)}
          </Button>
        </div>
      )}
      {extras.error && <p className="text-sm text-destructive">{extras.error}</p>}
    </section>
  )
}

function Related({ items }: { items: Array<{ id: string; title: string; done: boolean }> }) {
  return (
    <ul className="grid gap-1">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <StatusIcon tone={item.done ? 'done' : 'todo'} className="size-3" />
          <span className="min-w-0 truncate">{item.title}</span>
        </li>
      ))}
    </ul>
  )
}

export function TaskExtrasSide({ extras }: { extras: Extras }) {
  const { t } = useTranslation('planning')
  if (!extras.available) return null
  return (
    <div className="grid gap-4 border-t border-border pt-4" data-testid="task-extras">
      {extras.role && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t(PLANNING_TEXT.task.role)}</span>
          <RoleTag discipline={extras.role} />
        </div>
      )}
      {extras.storyCode && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t(PLANNING_TEXT.task.story)}</span>
          <CodeChip>{extras.storyCode}</CodeChip>
        </div>
      )}
      {extras.dependsOn.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t(PLANNING_TEXT.task.dependsOn)}</span>
          <Related items={extras.dependsOn} />
        </div>
      )}
      {extras.neededBy.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t(PLANNING_TEXT.task.neededBy)}</span>
          <Related items={extras.neededBy} />
        </div>
      )}
      {extras.attachments && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{t(PLANNING_TEXT.task.attachments)}</span>
          <ul className="grid gap-1 text-[13px] text-link">
            {extras.attachments.designs.map((title) => (
              <li key={title}>
                {t(PLANNING_TEXT.task.designs)} · {title}
              </li>
            ))}
            {extras.attachments.contracts.map((contract) => (
              <li key={contract} className="break-all">
                {t(PLANNING_TEXT.task.contracts)} · {contract}
              </li>
            ))}
            {extras.attachments.testCases.length > 0 && (
              <li>
                {t(PLANNING_TEXT.task.tests)} · {extras.attachments.testCases.join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
