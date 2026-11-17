import * as z from 'zod/mini'
import { apiCall } from '@/shared/services/api-client'

const endSessionResponseSchema = z.object({ redirectTo: z.string() })

// Ends the portal session and returns the address the app asked for on sign-out.
export const oidcLogoutService = {
  endSession: async (values: Record<string, string>): Promise<string> =>
    z.parse(endSessionResponseSchema, await apiCall('/api/oidc/end-session', { method: 'POST', body: values })).redirectTo,
}
