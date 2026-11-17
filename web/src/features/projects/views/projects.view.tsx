import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { useProjectsViewModel } from '@/features/projects/viewmodels/use-projects.viewmodel'
import { DocumentDetailView } from '@/features/projects/views/document-detail.view'
import { DocumentsListView } from '@/features/projects/views/documents-list.view'
import { EpicsListView } from '@/features/projects/views/epics-list.view'
import { FlowView } from '@/features/projects/views/flow.view'
import { ItemDetailView } from '@/features/projects/views/item-detail.view'
import { PlanningDialogsView } from '@/features/projects/views/planning-dialogs.view'
import { Notice } from '@/features/projects/views/planning-marks.view'
import { ProjectSectionNav } from '@/features/projects/views/project-section-nav.view'
import { TaskBoardView } from '@/features/projects/views/task-board.view'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Skeleton } from '@/shared/components/primitives/skeleton'

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
          {planning.section === 'flow' && <FlowView flow={planning.flow} onGo={planning.go} onManageTeam={onManageTeam} />}
          {planning.section === 'documents' &&
            (planning.detail === 'document' ? (
              <DocumentDetailView planning={planning} />
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
          {planning.section === 'board' && vm.selectedProject && <TaskBoardView vm={vm} />}
        </>
      )}

      <PlanningDialogsView dialogs={planning.dialogs} />
    </div>
  )
}
