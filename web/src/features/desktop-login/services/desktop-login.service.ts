import * as z from 'zod/mini'
import { apiCall } from '@/shared/services/api-client'

const approveResponseSchema = z.object({ code: z.string() })

export const desktopLoginService = {
  approve: async (token: string): Promise<string> =>
    z.parse(approveResponseSchema, await apiCall('/api/desktop-login/approve', { token, method: 'POST' })).code,
}
