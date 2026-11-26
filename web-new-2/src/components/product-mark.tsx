import { FieldGroup } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"

export function ProductMark({ className }: { className?: string }) {
  return (
    <FieldGroup
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 flex-col items-center justify-center gap-1 p-0",
        className
      )}
    >
      <Separator className="h-0.5 w-3.5 rounded-full bg-sidebar-primary" />
      <Separator className="h-0.5 w-2.5 rounded-full bg-sidebar-primary" />
      <Separator className="h-0.5 w-3.5 rounded-full bg-sidebar-primary" />
    </FieldGroup>
  )
}
