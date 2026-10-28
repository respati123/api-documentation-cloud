import { useState } from 'react'
import { cn } from '@/shared/utils/cn'

interface SplitFlapProps {
  value: string
  className?: string
  'data-testid'?: string
}

export function SplitFlap({ value, className, ...props }: SplitFlapProps) {
  const [current, setCurrent] = useState(value)
  const [previous, setPrevious] = useState(value)
  const [revision, setRevision] = useState(0)

  if (value !== current) {
    setPrevious(current)
    setCurrent(value)
    setRevision((count) => count + 1)
  }

  const characters = Array.from(value)
  const previousCharacters = Array.from(previous)

  return (
    <span role="img" aria-label={value} className={cn('inline-flex gap-px font-semibold tabular-nums', className)} {...props}>
      {characters.map((character, index) => {
        const changed = previousCharacters[index] !== character && revision > 0
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: cells are fixed positions, and the revision restarts the animation
            key={`${revision}-${index}`}
            aria-hidden="true"
            data-flap-cell
            data-changed={changed ? 'true' : 'false'}
            className={cn(
              'grid h-6 place-items-center rounded-[3px] bg-secondary px-px text-sm text-foreground',
              character === ' ' ? 'w-1.5' : 'min-w-[0.7em]',
              'border-b border-background/60',
              changed && 'animate-flap-drop motion-reduce:animate-none',
            )}
          >
            {character}
          </span>
        )
      })}
    </span>
  )
}
