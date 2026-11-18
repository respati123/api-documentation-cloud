import type * as z from 'zod'
import { AppError } from '@/lib/errors/app-error'
import type { ErrorCode } from '@/lib/errors/codes'

// Parses request input with a zod schema. A failure carries every issue as { path, message }.
export function parseInput<T extends z.ZodType>(schema: T, value: unknown, code: ErrorCode): z.output<T> {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  throw new AppError(code, { details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) })
}
