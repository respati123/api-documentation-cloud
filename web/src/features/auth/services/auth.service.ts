import * as z from 'zod/mini'
import type { CloudUser } from '@/shared/models/user.model'
import { apiCall } from '@/shared/services/api-client'
import { type AuthSession, authSessionSchema, currentUserResponseSchema, okResponseSchema } from '../models/auth.model'

export const authService = {
  login: async (email: string, password: string): Promise<AuthSession> =>
    z.parse(authSessionSchema, await apiCall('/api/auth/login', { method: 'POST', body: { email, password } })),

  register: async (email: string, password: string): Promise<AuthSession> =>
    z.parse(authSessionSchema, await apiCall('/api/auth/register', { method: 'POST', body: { email, password } })),

  currentUser: async (token: string): Promise<CloudUser> => z.parse(currentUserResponseSchema, await apiCall('/api/me', { token })).user,

  logout: async (token: string): Promise<void> => {
    z.parse(okResponseSchema, await apiCall('/api/auth/logout', { token, method: 'POST' }))
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    z.parse(okResponseSchema, await apiCall('/api/auth/forgot-password', { method: 'POST', body: { email } }))
  },

  resetPassword: async (token: string, password: string): Promise<void> => {
    z.parse(okResponseSchema, await apiCall('/api/auth/reset-password', { method: 'POST', body: { token, password } }))
  },
}
