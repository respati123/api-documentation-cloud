import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/utils/cn'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent text-sm font-medium outline-none select-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline: 'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary',
        ghost: 'hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
        approve: 'bg-approve text-approve-foreground hover:bg-approve/85',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/30',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-2.5',
        xs: 'h-6 rounded-md px-2 text-xs [&_svg:not([class*="size-"])]:size-3',
        sm: 'h-7 rounded-md px-2.5 text-[0.8rem] [&_svg:not([class*="size-"])]:size-3.5',
        lg: 'h-9 px-2.5',
        icon: 'size-8',
        'icon-xs': 'size-6 rounded-md [&_svg:not([class*="size-"])]:size-3',
        'icon-sm': 'size-7 rounded-md',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
