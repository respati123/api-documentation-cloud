import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react'
import { Lock, MoreHorizontal, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { PROJECT_STATUS_ORDER, PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { Task, TaskStatus } from '@/features/projects/models/project.model'
import { WORK_ROLES, type WorkRole } from '@/features/projects/models/story.model'
import type { useProjectsViewModel } from '@/features/projects/viewmodels/use-projects.viewmodel'
import { Avatar, CodeChip, PriorityMark, RoleDot, RoleTag, StatusIcon, TASK_TONE } from '@/features/projects/views/planning-marks.view'
import { TaskDialogView } from '@/features/projects/views/task-dialog.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/primitives/dropdown-menu'
import { Input } from '@/shared/components/primitives/input'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { SelectField } from '@/shared/components/select-field'
import { cn } from '@/shared/utils/cn'

type ViewModel = ReturnType<typeof useProjectsViewModel>
type Column = ViewModel['columns'][number]
type Card = Column['items'][number]

function isStatus(value: unknown): value is TaskStatus {
  return PROJECT_STATUS_ORDER.includes(value as TaskStatus)
}

export function TaskBoardView({ vm }: { vm: ViewModel }) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')

  return (
    <section className="grid gap-3.5" aria-label={t(PLANNING_TEXT.nav.board)} data-testid="projects-board">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-80 min-w-52 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            data-testid="task-search"
            aria-label={t(PLANNING_TEXT.board.search)}
            placeholder={t(PLANNING_TEXT.board.search)}
            className="h-[34px] pl-8"
            value={vm.filters.search}
            onChange={(event) => vm.setSearch(event.target.value)}
          />
        </div>
        <FilterChip pressed={vm.filters.mine} onClick={vm.toggleMine} testId="task-filter-mine">
          {t(PLANNING_TEXT.board.mine)}
        </FilterChip>
        <FilterChip pressed={vm.filters.overdue} onClick={vm.toggleOverdue} testId="task-filter-overdue">
          {t(PLANNING_TEXT.board.overdue)}
        </FilterChip>
        <SelectField
          size="sm"
          label={tp(PROJECTS_TEXT.priorityTitle)}
          testId="task-filter-priority"
          className={cn(
            'h-[30px] w-auto rounded-full px-3 text-[12.5px] text-muted-foreground',
            vm.filters.priority && 'border-primary/30 bg-accent text-accent-foreground',
          )}
          value={vm.filters.priority}
          onValueChange={(value) => vm.setPriorityFilter(value as Task['priority'] | '')}
          options={[
            { value: '', label: t(PLANNING_TEXT.board.allPriorities) },
            ...(['urgent', 'high', 'medium', 'low'] as const).map((priority) => ({
              value: priority,
              label: tp(PROJECTS_TEXT.priority[priority]),
              icon: <PriorityMark priority={priority} label={tp(PROJECTS_TEXT.priority[priority])} />,
            })),
          ]}
        />
        <SelectField
          size="sm"
          label={tp(PROJECTS_TEXT.assignee)}
          testId="task-filter-assignee"
          className={cn(
            'h-[30px] w-auto rounded-full px-3 text-[12.5px] text-muted-foreground',
            'max-w-44',
            vm.filters.assigneeId && 'border-primary/30 bg-accent text-accent-foreground',
          )}
          value={vm.filters.assigneeId}
          onValueChange={vm.setAssigneeFilter}
          options={[
            { value: '', label: t(PLANNING_TEXT.board.allAssignees) },
            ...vm.members.map((member) => ({
              value: member.id,
              label: member.email.split('@')[0],
              icon: <Avatar name={member.email} className="size-5 text-[9px]" />,
            })),
          ]}
        />
        {vm.hasRoles && (
          <SelectField
            size="sm"
            label={t(PLANNING_TEXT.task.role)}
            testId="task-filter-role"
            className={cn(
              'h-[30px] w-auto rounded-full px-3 text-[12.5px] text-muted-foreground',
              vm.filters.role && 'border-primary/30 bg-accent text-accent-foreground',
            )}
            value={vm.filters.role}
            onValueChange={(value) => vm.setRoleFilter(value as WorkRole | '')}
            options={[
              { value: '', label: t(PLANNING_TEXT.board.allRoles) },
              ...WORK_ROLES.map((role) => ({
                value: role,
                label: tp(PROJECTS_TEXT.discipline[role]),
                icon: <RoleDot discipline={role} />,
              })),
            ]}
          />
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {t(PLANNING_TEXT.board.count, { shown: vm.shownCount, total: vm.totalCount })}
        </span>
        {vm.canEdit && (
          <Button data-testid="task-new" onClick={() => vm.openCreate('todo')}>
            <Plus data-icon="inline-start" />
            {t(PLANNING_TEXT.board.newTask)}
          </Button>
        )}
      </div>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}

      <nav aria-label={tp(PROJECTS_TEXT.statusTitle)} className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 md:hidden">
        {vm.columns.map((column) => (
          <Button
            key={column.status}
            size="sm"
            variant="ghost"
            aria-current={vm.mobileStatus === column.status ? 'true' : undefined}
            data-testid={`task-mobile-${column.status}`}
            className={cn(
              'shrink-0',
              vm.mobileStatus === column.status ? 'bg-card text-foreground shadow-xs hover:bg-card' : 'text-muted-foreground',
            )}
            onClick={() => vm.setMobileStatus(column.status)}
          >
            {column.title}
            <span className="text-muted-foreground tabular-nums">{column.total}</span>
          </Button>
        ))}
      </nav>

      {vm.tasksLoading ? (
        <div className="grid gap-3 md:grid-cols-5">
          {PROJECT_STATUS_ORDER.map((status) => (
            <Skeleton key={status} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (
        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) return
            const { source, target } = event.operation
            if (source && target && isStatus(target.id)) vm.onMoveTask(String(source.id), target.id)
          }}
        >
          <div className="grid items-start gap-3 md:grid-cols-[repeat(5,minmax(220px,1fr))] md:overflow-x-auto md:pb-2">
            {vm.columns.map((column) => (
              <BoardColumn key={column.status} column={column} vm={vm} hiddenOnMobile={column.status !== vm.mobileStatus} />
            ))}
          </div>
        </DragDropProvider>
      )}
      <p className="text-[12.5px] text-muted-foreground">{vm.canEdit ? t(PLANNING_TEXT.board.hint) : t(PLANNING_TEXT.board.readOnly)}</p>

      <TaskDialogView vm={vm} />
    </section>
  )
}

function FilterChip({ pressed, onClick, testId, children }: { pressed: boolean; onClick: () => void; testId: string; children: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      data-testid={testId}
      className={cn(
        'h-[30px] rounded-full px-3 text-[12.5px] text-muted-foreground',
        pressed && 'border-primary/30 bg-accent text-accent-foreground hover:bg-accent',
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function BoardColumn({ column, vm, hiddenOnMobile }: { column: Column; vm: ViewModel; hiddenOnMobile: boolean }) {
  const { t } = useTranslation('planning')
  const { ref, isDropTarget } = useDroppable({ id: column.status, disabled: !vm.canEdit })
  return (
    <section
      ref={ref}
      aria-label={column.title}
      data-testid={`task-column-${column.status}`}
      className={cn(
        'grid min-h-52 content-start gap-2 rounded-xl bg-muted p-2 transition-colors',
        isDropTarget && 'bg-accent outline-2 -outline-offset-[3px] outline-primary outline-dashed',
        hiddenOnMobile && 'hidden md:grid',
      )}
    >
      <h3 className="flex items-center gap-2 px-1.5 py-1 text-[13px] font-semibold">
        <StatusIcon tone={TASK_TONE[column.status]} />
        {column.title}
        <span className="font-normal text-muted-foreground tabular-nums">{column.total}</span>
      </h3>
      {column.items.length === 0 && <p className="px-1.5 py-1 text-xs text-muted-foreground">{t(PLANNING_TEXT.board.empty)}</p>}
      {column.items.map((task) => (
        <TaskCard key={task.id} task={task} vm={vm} />
      ))}
      {column.hiddenCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="justify-start text-accent-foreground"
          data-testid="task-done-show-all"
          onClick={vm.onToggleDone}
        >
          {t(PLANNING_TEXT.board.showAll, { count: column.total })}
        </Button>
      )}
      {column.canCollapse && (
        <Button
          size="sm"
          variant="ghost"
          className="justify-start text-accent-foreground"
          data-testid="task-done-collapse"
          onClick={vm.onToggleDone}
        >
          {t(PLANNING_TEXT.board.collapse)}
        </Button>
      )}
    </section>
  )
}

function TaskCard({ task, vm }: { task: Card; vm: ViewModel }) {
  const { t } = useTranslation('planning')
  const { t: tp } = useTranslation('projects')
  const { ref, isDragging } = useDraggable({ id: task.id, disabled: !task.draggable })
  const assignee = task.assigneeEmail?.split('@')[0] ?? tp(PROJECTS_TEXT.unassigned)

  return (
    <article
      ref={ref}
      data-testid={`task-card-${task.id}`}
      className={cn(
        'relative grid gap-2 rounded-xl border border-border bg-card px-3 py-2.5 transition-[border-color,opacity] hover:border-foreground/20',
        task.draggable && 'cursor-grab active:cursor-grabbing',
        task.locked && 'border-dashed bg-muted/30',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <PriorityMark priority={task.priority} label={tp(PROJECTS_TEXT.priority[task.priority])} />
          {task.role && <RoleTag discipline={task.role} />}
        </span>
        {task.draggable && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="icon-xs" variant="ghost" aria-label={t(PLANNING_TEXT.board.moveTo)} data-testid={`task-move-${task.id}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t(PLANNING_TEXT.board.moveTo)}</DropdownMenuLabel>
                {PROJECT_STATUS_ORDER.filter((status) => status !== task.status).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    data-testid={`task-move-${task.id}-${status}`}
                    onClick={() => vm.onMoveTask(task.id, status)}
                  >
                    <StatusIcon tone={TASK_TONE[status]} />
                    {tp(PROJECTS_TEXT.statuses[status])}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Button
        variant="ghost"
        data-testid={`task-open-${task.id}`}
        className="h-auto justify-start p-0 text-left text-[13.5px] leading-snug font-semibold whitespace-normal hover:bg-transparent hover:underline"
        onClick={() => vm.openTask(task.id)}
      >
        {task.title}
      </Button>
      {task.description && <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{task.description}</p>}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={task.assigneeEmail ?? ''} className="size-6" />
          <span className="truncate">{assignee}</span>
          {task.storyCode && <CodeChip>{task.storyCode}</CodeChip>}
          {task.subtasks && <span className="tabular-nums">{task.subtasks}</span>}
        </span>
        {task.locked ? (
          <span className="flex shrink-0 items-center gap-1">
            <Lock className="size-3" />
            {t(PLANNING_TEXT.board.locked)}
          </span>
        ) : (
          task.due && (
            <span className={cn('shrink-0', task.overdue && 'font-semibold text-destructive')}>
              {task.overdue ? t(PLANNING_TEXT.board.overdueDate, { date: task.due }) : task.due}
            </span>
          )
        )}
      </div>
    </article>
  )
}
