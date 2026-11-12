import { useTranslation } from 'react-i18next'
import { PROJECT_STATUS_ORDER, PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { Task } from '@/features/projects/models/project.model'
import type { useProjectsViewModel } from '@/features/projects/viewmodels/use-projects.viewmodel'
import { PlanningCommentsView } from '@/features/projects/views/planning-comments.view'
import { Avatar, PriorityMark, StatusIcon, TASK_TONE } from '@/features/projects/views/planning-marks.view'
import { TaskExtrasSide, TaskSubtasks } from '@/features/projects/views/task-extras.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/components/primitives/dialog'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Textarea } from '@/shared/components/primitives/textarea'
import { SelectField } from '@/shared/components/select-field'

type ViewModel = ReturnType<typeof useProjectsViewModel>

// Two columns, as in the prototype: the work on the left, its properties on the right. On a phone the columns stack.
export function TaskDialogView({ vm }: { vm: ViewModel }) {
  const { t } = useTranslation('projects')
  const readOnly = !vm.canEdit

  return (
    <Dialog open={vm.taskDialogOpen} onOpenChange={vm.setTaskDialogOpen}>
      <DialogContent data-testid="task-dialog" className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[980px]">
        {/* Not a form: the discussion inside has its own form, and forms cannot nest. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-[18px] py-3">
            <div className="grid gap-0.5">
              <DialogTitle className="font-heading text-base">
                {vm.editingTaskId ? t(PROJECTS_TEXT.taskDetails) : t(PROJECTS_TEXT.newTask)}
              </DialogTitle>
              <DialogDescription className="text-xs">{vm.workspaceName}</DialogDescription>
            </div>
          </header>
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_280px] md:overflow-hidden">
            <div className="grid content-start gap-4 px-5 py-5 md:overflow-y-auto">
              <div className="grid gap-1.5">
                <Label htmlFor="task-title">{t(PROJECTS_TEXT.taskTitle)}</Label>
                <Input
                  id="task-title"
                  data-testid="task-title"
                  autoFocus
                  className="h-10 font-heading text-lg font-semibold"
                  value={vm.taskTitle}
                  readOnly={readOnly}
                  onChange={(event) => vm.setTaskTitle(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-description">{t(PROJECTS_TEXT.taskDescription)}</Label>
                <Textarea
                  id="task-description"
                  data-testid="task-description"
                  className="min-h-36"
                  value={vm.taskDescription}
                  readOnly={readOnly}
                  onChange={(event) => vm.setTaskDescription(event.target.value)}
                />
              </div>
              {vm.editingTaskId && <TaskSubtasks extras={vm.taskExtras} canEdit={vm.canEdit} />}
              {vm.taskError && (
                <Alert variant="destructive">
                  <AlertDescription>{vm.taskError}</AlertDescription>
                </Alert>
              )}
              {vm.canSeeTaskComments && <PlanningCommentsView vm={vm.taskComments} testId="task-comments" />}
            </div>
            <aside className="grid min-w-0 content-start gap-4 border-t border-border bg-muted/40 px-[18px] py-5 md:overflow-x-hidden md:overflow-y-auto md:border-t-0 md:border-l">
              <div className="grid gap-1.5">
                <Label htmlFor="task-status">{t(PROJECTS_TEXT.statusTitle)}</Label>
                <SelectField
                  id="task-status"
                  label={t(PROJECTS_TEXT.statusTitle)}
                  testId="task-status-select"
                  disabled={readOnly}
                  value={vm.taskStatus}
                  onValueChange={(value) => vm.setTaskStatus(value as Task['status'])}
                  options={PROJECT_STATUS_ORDER.map((status) => ({
                    value: status,
                    label: t(PROJECTS_TEXT.statuses[status]),
                    icon: <StatusIcon tone={TASK_TONE[status]} />,
                  }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-assignee">{t(PROJECTS_TEXT.assignee)}</Label>
                <SelectField
                  id="task-assignee"
                  label={t(PROJECTS_TEXT.assignee)}
                  testId="task-assignee-select"
                  disabled={readOnly}
                  value={vm.assigneeId}
                  onValueChange={vm.setAssigneeId}
                  options={[
                    { value: '', label: t(PROJECTS_TEXT.unassigned) },
                    ...vm.members.map((member) => ({
                      value: member.id,
                      label: member.email.split('@')[0],
                      hint: member.email,
                      icon: <Avatar name={member.email} className="size-5 text-[9px]" />,
                    })),
                  ]}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-priority">{t(PROJECTS_TEXT.priorityTitle)}</Label>
                <SelectField
                  id="task-priority"
                  label={t(PROJECTS_TEXT.priorityTitle)}
                  testId="task-priority-select"
                  disabled={readOnly}
                  value={vm.taskPriority}
                  onValueChange={(value) => vm.setTaskPriority(value as Task['priority'])}
                  options={(['low', 'medium', 'high', 'urgent'] as const).map((priority) => ({
                    value: priority,
                    label: t(PROJECTS_TEXT.priority[priority]),
                    icon: <PriorityMark priority={priority} label={t(PROJECTS_TEXT.priority[priority])} />,
                  }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-due-date">{t(PROJECTS_TEXT.dueDate)}</Label>
                <Input
                  id="task-due-date"
                  data-testid="task-due-date"
                  type="date"
                  value={vm.taskDueDate}
                  readOnly={readOnly}
                  onChange={(event) => vm.setTaskDueDate(event.target.value)}
                />
              </div>
              {vm.editingTaskId && <TaskExtrasSide extras={vm.taskExtras} />}
            </aside>
          </div>
          <footer className="flex justify-end gap-2 border-t border-border px-[18px] py-3">
            <Button type="button" variant="outline" data-testid="task-cancel" onClick={() => vm.setTaskDialogOpen(false)}>
              {t(PROJECTS_TEXT.cancel)}
            </Button>
            {vm.canEdit && (
              <Button data-testid="task-save" type="button" disabled={vm.isSavingTask || !vm.taskTitle.trim()} onClick={vm.onSaveTask}>
                {vm.editingTaskId ? t(PROJECTS_TEXT.saveChanges) : t(PROJECTS_TEXT.createTask)}
              </Button>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
