import type { AuthMode } from '../models/auth.model'

export const AUTH_TEXT = {
  brand: {
    name: 'brand.name',
    title: 'brand.title',
    copy: 'brand.copy',
    foot: 'brand.foot',
  },
  field: {
    email: 'field.email',
    password: 'field.password',
    newPassword: 'field.newPassword',
  },
  placeholder: {
    email: 'placeholder.email',
    password: 'placeholder.password',
    newPassword: 'placeholder.newPassword',
  },
  hint: 'hint',
  forgot: 'forgot',
  localNote: 'localNote',
  preview: {
    title: 'preview.title',
    createCharge: 'preview.createCharge',
    listCharges: 'preview.listCharges',
    refund: 'preview.refund',
    synced: 'preview.synced',
    pending: 'preview.pending',
    footer: 'preview.footer',
  },
  notice: {
    resetSent: 'auth:notice.resetSent',
    passwordUpdated: 'auth:notice.passwordUpdated',
    sessionExpired: 'auth:notice.sessionExpired',
  },
} as const

export const AUTH_HEADING_TEXT = {
  login: 'heading.login',
  register: 'heading.register',
  forgot: 'heading.forgot',
  reset: 'heading.reset',
} as const satisfies Record<AuthMode, string>

export const AUTH_SUBTITLE_TEXT = {
  login: 'subtitle.login',
  register: 'subtitle.register',
  forgot: 'subtitle.forgot',
  reset: 'subtitle.reset',
} as const satisfies Record<AuthMode, string>

export const AUTH_SUBMIT_TEXT = {
  login: 'submit.login',
  register: 'submit.register',
  forgot: 'submit.forgot',
  reset: 'submit.reset',
} as const satisfies Record<AuthMode, string>

export const AUTH_BUSY_TEXT = {
  login: 'busy.login',
  register: 'busy.register',
  forgot: 'busy.forgot',
  reset: 'busy.reset',
} as const satisfies Record<AuthMode, string>

export const AUTH_SWITCH_TEXT: Partial<Record<AuthMode, { prompt: string; target: AuthMode; label: string }>> = {
  login: { prompt: 'switch.newHere', target: 'register', label: 'switch.createAccount' },
  register: { prompt: 'switch.haveAccount', target: 'login', label: 'switch.signIn' },
  forgot: { prompt: 'switch.remembered', target: 'login', label: 'switch.backToSignIn' },
}

// Sample rows for the brand panel. Paths and methods are data, so they are not translated.
export const AUTH_PREVIEW_ROWS = [
  { method: 'POST', path: '/v1/charges', name: AUTH_TEXT.preview.createCharge, status: AUTH_TEXT.preview.synced },
  { method: 'GET', path: '/v1/charges', name: AUTH_TEXT.preview.listCharges, status: AUTH_TEXT.preview.synced },
  { method: 'POST', path: '/v1/refunds', name: AUTH_TEXT.preview.refund, status: AUTH_TEXT.preview.pending },
] as const
