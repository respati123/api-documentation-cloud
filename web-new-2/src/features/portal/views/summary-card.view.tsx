import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'

export function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <Card className="min-w-0 gap-3 rounded-lg border-border bg-card p-4 shadow-none">
      <CardDescription className="font-medium text-foreground">{label}</CardDescription>
      <CardContent className="space-y-1 px-0">
        <CardTitle className="text-2xl tracking-tight">{value}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{detail}</CardDescription>
      </CardContent>
    </Card>
  )
}
