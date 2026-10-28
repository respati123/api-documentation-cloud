import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created } from '@/lib/http'
import { acceptInvite } from '@/services/invites'

export async function handleInviteAccept(ctx: AppContext, request: Request, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  if (method === 'POST' && path === '/api/invites/accept') {
    const body = await bodyOf(request)
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) throw new AppError('INVITE_TOKEN_REQUIRED')
    return created({ workspace: await acceptInvite(ctx, user, token) })
  }
  return undefined
}
