import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { navLabelKey } from '@/features/projects/utils/section-nav'
import type { ProjectSection } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { Button } from '@/shared/components/primitives/button'
import { AGILE_PROJECT_ENABLED } from '@/shared/config/features'
import { cn } from '@/shared/utils/cn'

export function ProjectSectionNav({
  current,
  sections,
  onSelect,
}: {
  current: ProjectSection
  sections: Array<{ id: ProjectSection; count: number | null }>
  onSelect: (section: ProjectSection) => void
}) {
  const { t } = useTranslation('planning')
  return (
    <nav aria-label={t(PLANNING_TEXT.nav.label)} className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
      {sections.map((section) => {
        const active = section.id === current
        return (
          <Button
            key={section.id}
            size="sm"
            variant="ghost"
            aria-current={active ? 'page' : undefined}
            data-testid={`projects-section-${section.id}`}
            className={cn(
              'h-[30px] rounded-[9px] px-3 text-[13px]',
              active ? 'bg-card text-foreground shadow-xs hover:bg-card' : 'text-muted-foreground',
            )}
            onClick={() => onSelect(section.id)}
          >
            {t(navLabelKey(section.id, AGILE_PROJECT_ENABLED))}
            {section.count !== null && <span className="text-[11.5px] text-muted-foreground tabular-nums">{section.count}</span>}
          </Button>
        )
      })}
    </nav>
  )
}
