import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import type { BacklogProps } from '@/features/projects/views/backlog.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Textarea } from '@/shared/components/primitives/textarea'
import { SelectField } from '@/shared/components/select-field'

type Actions = BacklogProps['actions']

function Form({
  open,
  onClose,
  onSubmit,
  title,
  detail,
  error,
  testId,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  onSubmit: () => void
  title: string
  detail: string
  error: string | null
  testId: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid={testId} className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{detail}</DialogDescription>
          </DialogHeader>
          {children}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function Buttons({
  cancel,
  confirm,
  onCancel,
  disabled,
  testId,
}: {
  cancel: string
  confirm: string
  onCancel: () => void
  disabled: boolean
  testId: string
}) {
  return (
    <>
      <Button type="button" variant="ghost" data-testid={`${testId}-cancel`} onClick={onCancel}>
        {cancel}
      </Button>
      <Button type="submit" data-testid={`${testId}-submit`} disabled={disabled}>
        {confirm}
      </Button>
    </>
  )
}

// The dialogs of the Backlog tab: a new issue, a new or edited sprint, closing a sprint, the override of the gate,
// and the Product Goal.
export function BacklogDialogsView({ actions }: { actions: Actions }) {
  const { t } = useTranslation('planning')
  const { issueDialog: issue, sprintDialog: sprint, closeDialog: close, overrideDialog: override, goalDialog: goal } = actions

  return (
    <>
      <Form
        open={issue.open}
        onClose={issue.onClose}
        onSubmit={issue.onSubmit}
        title={t(BACKLOG_TEXT.issueDialog.title)}
        detail={t(BACKLOG_TEXT.issueDialog.detail)}
        error={issue.error}
        testId="backlog-issue-dialog"
        footer={
          <Buttons
            testId="backlog-issue"
            cancel={t(BACKLOG_TEXT.issueDialog.cancel)}
            confirm={t(BACKLOG_TEXT.issueDialog.create)}
            onCancel={issue.onClose}
            disabled={!issue.canSubmit}
          />
        }
      >
        <Field id="backlog-issue-type" label={t(BACKLOG_TEXT.issueDialog.type)}>
          <SelectField
            id="backlog-issue-type"
            value={issue.type}
            onValueChange={issue.setType}
            options={issue.typeOptions}
            label={t(BACKLOG_TEXT.issueDialog.type)}
            testId="backlog-issue-type"
          />
        </Field>
        <Field id="backlog-issue-title" label={t(BACKLOG_TEXT.issueDialog.name)}>
          <Input
            id="backlog-issue-title"
            data-testid="backlog-issue-title"
            value={issue.title}
            maxLength={180}
            autoFocus
            onChange={(event) => issue.setTitle(event.target.value)}
          />
        </Field>
        <Field id="backlog-issue-description" label={t(BACKLOG_TEXT.issueDialog.description)}>
          <Textarea
            id="backlog-issue-description"
            data-testid="backlog-issue-description"
            value={issue.description}
            onChange={(event) => issue.setDescription(event.target.value)}
          />
        </Field>
        {issue.takesParent && (
          <Field id="backlog-issue-epic" label={t(BACKLOG_TEXT.issueDialog.epic)}>
            <SelectField
              id="backlog-issue-epic"
              value={issue.parentId}
              onValueChange={issue.setParentId}
              options={issue.epicOptions}
              label={t(BACKLOG_TEXT.issueDialog.epic)}
              testId="backlog-issue-epic"
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {issue.takesPoints && (
            <Field id="backlog-issue-points" label={t(BACKLOG_TEXT.issueDialog.points)}>
              <SelectField
                id="backlog-issue-points"
                value={issue.points}
                onValueChange={issue.setPoints}
                options={issue.pointsOptions}
                label={t(BACKLOG_TEXT.issueDialog.points)}
                testId="backlog-issue-points"
              />
            </Field>
          )}
          <Field id="backlog-issue-priority" label={t(BACKLOG_TEXT.issueDialog.priority)}>
            <SelectField
              id="backlog-issue-priority"
              value={issue.priority}
              onValueChange={issue.setPriority}
              options={issue.priorityOptions}
              label={t(BACKLOG_TEXT.issueDialog.priority)}
              testId="backlog-issue-priority"
            />
          </Field>
        </div>
      </Form>

      <Form
        open={sprint.open}
        onClose={sprint.onClose}
        onSubmit={sprint.onSubmit}
        title={t(sprint.editing ? BACKLOG_TEXT.sprintDialog.editTitle : BACKLOG_TEXT.sprintDialog.createTitle)}
        detail={t(BACKLOG_TEXT.sprintDialog.detail)}
        error={sprint.error}
        testId="backlog-sprint-dialog"
        footer={
          <Buttons
            testId="backlog-sprint"
            cancel={t(BACKLOG_TEXT.sprintDialog.cancel)}
            confirm={t(BACKLOG_TEXT.sprintDialog.save)}
            onCancel={sprint.onClose}
            disabled={!sprint.canSubmit}
          />
        }
      >
        <Field id="backlog-sprint-name" label={t(BACKLOG_TEXT.sprintDialog.name)}>
          <Input
            id="backlog-sprint-name"
            data-testid="backlog-sprint-name"
            value={sprint.name}
            maxLength={100}
            autoFocus
            onChange={(event) => sprint.setName(event.target.value)}
          />
        </Field>
        <Field id="backlog-sprint-goal" label={t(BACKLOG_TEXT.sprintDialog.goal)}>
          <Textarea
            id="backlog-sprint-goal"
            data-testid="backlog-sprint-goal"
            value={sprint.goal}
            onChange={(event) => sprint.setGoal(event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="backlog-sprint-starts" label={t(BACKLOG_TEXT.sprintDialog.starts)}>
            <Input
              id="backlog-sprint-starts"
              data-testid="backlog-sprint-starts"
              type="date"
              value={sprint.startsOn}
              onChange={(event) => sprint.setStartsOn(event.target.value)}
            />
          </Field>
          <Field id="backlog-sprint-ends" label={t(BACKLOG_TEXT.sprintDialog.ends)}>
            <Input
              id="backlog-sprint-ends"
              data-testid="backlog-sprint-ends"
              type="date"
              value={sprint.endsOn}
              onChange={(event) => sprint.setEndsOn(event.target.value)}
            />
          </Field>
        </div>
      </Form>

      <Form
        open={close.open}
        onClose={close.onClose}
        onSubmit={close.onSubmit}
        title={t(BACKLOG_TEXT.closeDialog.title, { name: close.name })}
        detail={t(BACKLOG_TEXT.closeDialog.detail)}
        error={close.error}
        testId="backlog-close-dialog"
        footer={
          <Buttons
            testId="backlog-close"
            cancel={t(BACKLOG_TEXT.closeDialog.cancel)}
            confirm={t(BACKLOG_TEXT.closeDialog.confirm)}
            onCancel={close.onClose}
            disabled={close.isSaving}
          />
        }
      >
        <Field id="backlog-close-carry" label={t(BACKLOG_TEXT.closeDialog.carry)}>
          <SelectField
            id="backlog-close-carry"
            value={close.carryTo}
            onValueChange={close.setCarryTo}
            options={close.options}
            label={t(BACKLOG_TEXT.closeDialog.carry)}
            testId="backlog-close-carry"
          />
        </Field>
      </Form>

      <Form
        open={override.open}
        onClose={override.onClose}
        onSubmit={override.onSubmit}
        title={t(BACKLOG_TEXT.override.title)}
        detail={t(BACKLOG_TEXT.override.detail, { title: override.title })}
        error={override.error}
        testId="backlog-override-dialog"
        footer={
          <Buttons
            testId="backlog-override"
            cancel={t(BACKLOG_TEXT.override.cancel)}
            confirm={t(BACKLOG_TEXT.override.confirm)}
            onCancel={override.onClose}
            disabled={!override.canSubmit}
          />
        }
      >
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {override.reasons.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
        </ul>
        <Field id="backlog-override-reason" label={t(BACKLOG_TEXT.override.reason)}>
          <Textarea
            id="backlog-override-reason"
            data-testid="backlog-override-reason"
            value={override.reason}
            autoFocus
            onChange={(event) => override.setReason(event.target.value)}
          />
        </Field>
      </Form>

      <Form
        open={goal.open}
        onClose={goal.onClose}
        onSubmit={goal.onSubmit}
        title={t(BACKLOG_TEXT.goalDialog.title)}
        detail={t(BACKLOG_TEXT.goalDialog.detail)}
        error={goal.error}
        testId="backlog-goal-dialog"
        footer={
          <Buttons
            testId="backlog-goal"
            cancel={t(BACKLOG_TEXT.goalDialog.cancel)}
            confirm={t(BACKLOG_TEXT.goalDialog.save)}
            onCancel={goal.onClose}
            disabled={goal.isSaving}
          />
        }
      >
        <Field id="backlog-goal-text" label={t(BACKLOG_TEXT.goalDialog.label)}>
          <Textarea
            id="backlog-goal-text"
            data-testid="backlog-goal-text"
            value={goal.goal}
            autoFocus
            onChange={(event) => goal.setGoal(event.target.value)}
          />
        </Field>
      </Form>
    </>
  )
}
