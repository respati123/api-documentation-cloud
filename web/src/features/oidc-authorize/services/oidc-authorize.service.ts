import * as z from 'zod/mini'
import { apiCall } from '@/shared/services/api-client'

const authorizeResponseSchema = z.object({ redirectTo: z.string() })

// Sends the OIDC query values to the server. The server checks them and answers with the address to return to.
export const oidcAuthorizeService = {
  authorize: async (values: Record<string, string>): Promise<string> =>
    z.parse(authorizeResponseSchema, await apiCall('/api/oidc/authorize', { method: 'POST', body: values })).redirectTo,
}
