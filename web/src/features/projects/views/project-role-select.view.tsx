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

export function ProjectRoleSelect({
  value,
  editable,
  saving,
  onChange,
  testId,
}: {
  value: string | null
  editable: boolean
  saving: boolean
  onChange: (discipline: ProjectDiscipline) => void
  testId: string
}) {
  const { t } = useTranslation('projects')
  const label = (discipline: string | null) =>
    isDiscipline(discipline) ? t(PROJECTS_TEXT.discipline[discipline]) : t(PROJECTS_TEXT.unassigned)

  if (!editable) return <Badge variant={value ? 'secondary' : 'outline'}>{label(value)}</Badge>
  return (
    <Select value={value ?? ''} disabled={saving} onValueChange={(next) => isDiscipline(next) && onChange(next)}>
      <SelectTrigger size="sm" className="w-36" data-testid={testId} aria-label={t(PROJECTS_TEXT.disciplineTitle)}>
        <SelectValue>{(current: string) => label(current || null)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {DISCIPLINE_ORDER.map((discipline) => (
          <SelectItem key={discipline} value={discipline}>
            {t(PROJECTS_TEXT.discipline[discipline])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
