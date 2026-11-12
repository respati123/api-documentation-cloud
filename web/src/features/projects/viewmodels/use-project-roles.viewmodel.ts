import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { ProjectDiscipline } from '@/features/projects/models/project.model'
import { projectsService } from '@/features/projects/services/projects.service'
import { projectKeys } from '@/features/projects/viewmodels/project-keys'
import { readErrorMessage } from '@/shared/utils/error-message'

// A workspace has one project, so a member's project role is their role in the workspace's first project.
export function useProjectRolesViewModel(workspaceId: string, isOwner: boolean, enabled: boolean) {
  const { t } = useTranslation('projects')
  const token = useAuthSessionStore((state) => state.token)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const ready = enabled && Boolean(workspaceId)

  const projects = useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => projectsService.list(token, workspaceId),
    enabled: ready,
    staleTime: 30_000,
  })
  const members = useQuery({
    queryKey: [...projectKeys.all, workspaceId, 'members'],
    queryFn: () => projectsService.members(token, workspaceId),
    enabled: ready,
  })
  const projectId = projects.data?.[0]?.id ?? ''

  const assign = useMutation({
    mutationFn: ({ memberId, discipline }: { memberId: string; discipline: ProjectDiscipline }) =>
      projectsService.assignProjectMember(token, workspaceId, projectId, memberId, discipline),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...projectKeys.all, workspaceId, 'members'] }),
  })

  const roles = new Map((members.data ?? []).map((member) => [member.id, member.discipline]))
  const failure = assign.error ?? members.error ?? projects.error

  return {
    roleOf: (memberId: string) => roles.get(memberId) ?? null,
    canAssign: Boolean(projectId) && (isOwner || roles.get(userId) === 'pm'),
    savingMemberId: assign.isPending ? assign.variables.memberId : null,
    onAssign: (memberId: string, discipline: ProjectDiscipline) => assign.mutate({ memberId, discipline }),
    error: failure ? readErrorMessage(failure, t(PROJECTS_TEXT.error)) : null,
  }
}
