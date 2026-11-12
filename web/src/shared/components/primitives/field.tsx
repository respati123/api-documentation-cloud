import type * as React from 'react'
import { cn } from '@/shared/utils/cn'
import { Label } from './label'

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field-group" className={cn('flex w-full flex-col gap-5', className)} {...props} />
}

function Field({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset data-slot="field" className={cn('group/field m-0 flex w-full min-w-0 flex-col gap-2 border-0 p-0', className)} {...props} />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<'label'>) {
  return <Label data-slot="field-label" className={cn('w-fit', className)} {...props} />
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="field-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Field, FieldDescription, FieldGroup, FieldLabel }
