import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

const Select = SelectPrimitive.Root

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" className={cn('flex flex-1 text-left', className)} {...props} />
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-background py-1.5 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />} />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none',
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-selected:font-medium data-selected:text-foreground',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
      >
        <CheckIcon className="pointer-events-none size-4 text-primary" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
