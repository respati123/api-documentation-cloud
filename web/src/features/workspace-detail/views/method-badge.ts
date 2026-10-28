export function methodVariant(method: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const normalized = method.toUpperCase()
  if (normalized === 'GET') return 'secondary'
  if (normalized === 'DELETE') return 'destructive'
  if (normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH') return 'default'
  return 'outline'
}
