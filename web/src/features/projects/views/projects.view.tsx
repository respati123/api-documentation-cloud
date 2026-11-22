import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { useProjectsViewModel } from '@/features/projects/viewmodels/use-projects.viewmodel'
import { BacklogView } from '@/features/projects/views/backlog.view'
import { DocumentDetailView } from '@/features/projects/views/document-detail.view'
import { DocumentsListView } from '@/features/projects/views/documents-list.view'
import { EpicsListView } from '@/features/projects/views/epics-list.view'
import { FlowView } from '@/features/projects/views/flow.view'
import { IssueDetailView } from '@/features/projects/views/issue-detail.view'
import { ItemDetailView } from '@/features/projects/views/item-detail.view'
import { KanbanBoardView } from '@/features/projects/views/kanban-board.view'
import { PlanningDialogsView } from '@/features/projects/views/planning-dialogs.view'
import { Notice } from '@/features/projects/views/planning-marks.view'
import { ProjectSectionNav } from '@/features/projects/views/project-section-nav.view'
import { ReportsView } from '@/features/projects/views/reports.view'
import { SprintBoardView } from '@/features/projects/views/sprint-board.view'
import { TaskBoardView } from '@/features/projects/views/task-board.view'
import { TimelineView } from '@/features/projects/views/timeline.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { AGILE_PROJECT_ENABLED } from '@/shared/config/features'

export type ProjectsViewProps = ReturnType<typeof useProjectsViewModel> & { onManageTeam: () => void }

// The project tab: a section switcher, then one screen at a time, as in the approved prototype.
export function ProjectsView({ onManageTeam, ...vm }: ProjectsViewProps) {
  const { t } = useTranslation('planning')
  const planning = vm.planning
  const loading = vm.status === 'loading' || planning.status === 'loading'

  return (
    <div className="grid gap-4" data-testid="projects-view">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProjectSectionNav current={planning.section} sections={planning.sections} onSelect={planning.go} />
        <Button
          variant={planning.sample.on ? 'secondary' : 'ghost'}
          size="sm"
          data-testid="projects-sample-toggle"
          onClick={planning.sample.onToggle}
        >
          <FlaskConical data-icon="inline-start" />
          {planning.sample.on ? t(PLANNING_TEXT.sample.hide) : t(PLANNING_TEXT.sample.show)}
        </Button>
      </div>
      {planning.sample.on && (
        <Notice tone="warning" testId="projects-sample-notice">
          <p className="text-sm">
            <span className="font-semibold">{t(PLANNING_TEXT.sample.badge)}</span> · {t(PLANNING_TEXT.sample.notice)}
          </p>
        </Notice>
      )}

      {planning.error && (
        <Alert variant="destructive">
          <AlertDescription>{planning.error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4" data-testid="projects-loading">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {planning.section === 'flow' && (
            <FlowView
              flow={planning.flow}
              sprint={AGILE_PROJECT_ENABLED && vm.mode === 'scrum' ? vm.sprintSummary : undefined}
              onGo={planning.go}
              onManageTeam={onManageTeam}
            />
          )}
          {planning.section === 'documents' &&
            (planning.detail === 'document' ? (
              <DocumentDetailView planning={planning} draftBacklog={vm.draftBacklog} />
            ) : (
              <DocumentsListView
                documents={planning.documents}
                canManage={planning.access.canManage}
                onUpload={() => planning.dialogs.upload.onOpen()}
                onWrite={() => planning.dialogs.write.onOpen('brd')}
                onWritePrd={() => planning.dialogs.write.onOpen('prd')}
                canWritePrd={planning.dialogs.write.canWritePrd}
              />
            ))}
          {planning.section === 'epics' &&
            (planning.detail === 'item' ? (
              <ItemDetailView
                planning={planning}
                onNewStory={(epicId) => planning.dialogs.item.onOpen(epicId)}
                onOpenTask={(taskId) => {
                  planning.go('board')
                  vm.openTask(taskId)
                }}
              />
            ) : (
              <EpicsListView
                epics={planning.epics}
                canManage={planning.access.canManage}
                onNewEpic={() => planning.dialogs.item.onOpen()}
                onNewStory={(epicId) => planning.dialogs.item.onOpen(epicId)}
              />
            ))}
          {planning.section === 'backlog' && <BacklogView vm={vm.backlog} onOpenIssue={vm.issueDetail.open} />}
          {planning.section === 'board' &&
            vm.selectedProject &&
            (AGILE_PROJECT_ENABLED && vm.mode === 'kanban' ? (
              <KanbanBoardView vm={vm.kanbanBoard} onOpenIssue={vm.issueDetail.open} />
            ) : AGILE_PROJECT_ENABLED ? (
              <SprintBoardView vm={vm.sprintBoard} onOpenBacklog={() => planning.go('backlog')} onOpenIssue={vm.issueDetail.open} />
            ) : (
              <TaskBoardView vm={vm} />
            ))}
          {planning.section === 'timeline' && <TimelineView vm={vm.timeline} />}
          {planning.section === 'reports' && <ReportsView vm={vm.reports} />}
        </>
      )}

      {AGILE_PROJECT_ENABLED && <IssueDetailView vm={vm.issueDetail} extras={vm.issueStory} />}
      <PlanningDialogsView dialogs={planning.dialogs} />
    </div>
  )
}
