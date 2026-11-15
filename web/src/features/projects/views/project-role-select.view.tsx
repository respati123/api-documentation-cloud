import { useTranslation } from 'react-i18next'
import * as z from 'zod/mini'
import { PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import { type ProjectDiscipline, projectDisciplineSchema } from '@/features/projects/models/project.model'
import { Badge } from '@/shared/components/primitives/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/primitives/select'

const DISCIPLINE_ORDER: readonly ProjectDiscipline[] = [
  'pm',
  'tech_lead',
  'ui_ux',
  'backend',
  'frontend',
  'mobile',
  'qa',
  'devops',
  'other',
]

function isDiscipline(value: unknown): value is ProjectDiscipline {
  return z.safeParse(projectDisciplineSchema, value).success
}

// A member can hold several project roles, for example backend and QA. Their MCP tools follow these roles.
export function ProjectRoleSelect({
  value,
  editable,
  saving,
  onChange,
  testId,
}: {
  value: readonly string[]
  editable: boolean
  saving: boolean
  onChange: (disciplines: ProjectDiscipline[]) => void
  testId: string
}) {
  const { t } = useTranslation('projects')
  const roles = DISCIPLINE_ORDER.filter((discipline) => value.includes(discipline))
  const summary = (selected: readonly string[]) =>
    selected.length === 0
      ? t(PROJECTS_TEXT.unassigned)
      : DISCIPLINE_ORDER.filter((discipline) => selected.includes(discipline))
          .map((discipline) => t(PROJECTS_TEXT.discipline[discipline]))
          .join(', ')

  if (!editable)
    return roles.length === 0 ? (
      <Badge variant="outline">{t(PROJECTS_TEXT.unassigned)}</Badge>
    ) : (
      <span className="flex flex-wrap gap-1">
        {roles.map((discipline) => (
          <Badge key={discipline} variant="secondary">
            {t(PROJECTS_TEXT.discipline[discipline])}
          </Badge>
        ))}
      </span>
    )
  return (
    <Select multiple value={roles} onValueChange={(next) => Array.isArray(next) && onChange(next.filter(isDiscipline))}>
      <SelectTrigger
        size="sm"
        className="w-48 max-w-full"
        data-testid={testId}
        data-saving={saving || undefined}
        aria-label={t(PROJECTS_TEXT.disciplineTitle)}
      >
        <SelectValue className="truncate">{(current: readonly string[]) => summary(current ?? [])}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {DISCIPLINE_ORDER.map((discipline) => (
          <SelectItem key={discipline} value={discipline} data-testid={`${testId}-${discipline}`}>
            {t(PROJECTS_TEXT.discipline[discipline])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
