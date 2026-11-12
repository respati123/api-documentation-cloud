import type * as React from 'react'
import { cn } from '@/shared/utils/cn'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // Wraps an input the caller passes in, so the label has no control of its own.
    // biome-ignore lint/a11y/noLabelWithoutControl: the caller ties the label with htmlFor
    <label data-slot="label" className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none', className)} {...props} />
  )
}

export { Label }
