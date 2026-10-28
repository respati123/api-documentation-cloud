import { AppError } from './errors/app-error'
import { isRecord } from './validation'

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    if (!isRecord(body)) throw new Error()
    return body
  } catch { throw new AppError('BODY_NOT_OBJECT') }
}
