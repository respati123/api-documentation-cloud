import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/primitives/select'
import { cn } from '@/shared/utils/cn'

export interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
  hint?: string
}

// Base UI treats an empty value as "nothing selected", so an option whose value is '' is stored under this key.
const EMPTY = '__empty__'
const toKey = (value: string) => (value === '' ? EMPTY : value)
const fromKey = (key: string) => (key === EMPTY ? '' : key)

// A styled dropdown for a list of options: the trigger shows the chosen label and icon, the list opens under it.
export function SelectField({
  value,
  onValueChange,
  options,
  label,
  testId,
  id,
  size = 'default',
  className,
  disabled,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  label: string
  testId: string
  id?: string
  size?: 'sm' | 'default'
  className?: string
  disabled?: boolean
}) {
  const selected = options.find((option) => option.value === value)
  return (
    <Select value={toKey(value)} disabled={disabled} onValueChange={(next) => typeof next === 'string' && onValueChange(fromKey(next))}>
      <SelectTrigger id={id} size={size} aria-label={label} data-testid={testId} className={cn('w-full', className)}>
        <SelectValue>
          {() => (
            <span className="flex min-w-0 items-center gap-2">
              {selected?.icon}
              <span className="truncate">{selected?.label ?? ''}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={toKey(option.value)} value={toKey(option.value)} data-testid={`${testId}-option-${toKey(option.value)}`}>
            {option.icon}
            <span className="grid min-w-0">
              <span className="truncate">{option.label}</span>
              {option.hint && <span className="truncate text-xs font-normal text-muted-foreground">{option.hint}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
