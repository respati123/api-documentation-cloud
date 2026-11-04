import * as z from 'zod/mini'
import { apiCall } from '@/shared/services/api-client'

const approveResponseSchema = z.object({ box: z.string() })

// Approves the desktop sign-in. The desktop's public key seals the session, so only that desktop can open it.
export const desktopLoginService = {
  approve: async (publicKey: string): Promise<string> =>
    z.parse(approveResponseSchema, await apiCall('/api/desktop-login/approve', { method: 'POST', body: { publicKey } })).box,
}
