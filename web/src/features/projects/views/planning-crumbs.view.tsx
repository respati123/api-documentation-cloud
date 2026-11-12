import { Fragment } from 'react'
import { Button } from '@/shared/components/primitives/button'

export interface Crumb {
  label: string
  onSelect?: () => void
  testId?: string
}

export function PlanningCrumbs({ crumbs, label }: { crumbs: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.testId ?? crumb.label}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {crumb.onSelect ? (
            <Button
              variant="link"
              className="h-auto px-0 text-[12.5px] font-normal text-muted-foreground hover:text-foreground"
              data-testid={crumb.testId}
              onClick={crumb.onSelect}
            >
              {crumb.label}
            </Button>
          ) : (
            <span aria-current="page" className="text-foreground">
              {crumb.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
