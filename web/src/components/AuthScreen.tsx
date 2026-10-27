import { FormEvent, useState } from 'react'

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

type Props = {
  mode: AuthMode
  setMode: (mode: AuthMode) => void
  busy: boolean
  error: string
  notice: string
  inviteMessage: string
  onSubmit: (event: FormEvent<HTMLFormElement>, email: string, password: string) => void
}

const headings: Record<AuthMode, string> = {
  login: 'Sign in to your workspace',
  register: 'Create your account',
  forgot: 'Reset your password',
  reset: 'Choose a new password'
}

const subtitles: Record<AuthMode, string> = {
  login: 'Continue to your shared collections and API references.',
  register: 'Use your team email to create an account.',
  forgot: 'Enter the email you use for this account. If it exists, we will send a link to reset your password.',
  reset: 'Enter a new password. This signs you out on every device.'
}

const submitLabels: Record<AuthMode, string> = {
  login: 'Sign in',
  register: 'Create account',
  forgot: 'Send reset link',
  reset: 'Update password'
}

const busyLabels: Record<AuthMode, string> = {
  login: 'Signing in…',
  register: 'Creating account…',
  forgot: 'Sending link…',
  reset: 'Updating password…'
}

const switches: Partial<Record<AuthMode, { prompt: string; target: AuthMode; label: string }>> = {
  login: { prompt: 'New to API Documentation?', target: 'register', label: 'Create account' },
  register: { prompt: 'Already have an account?', target: 'login', label: 'Sign in' },
  forgot: { prompt: 'Remembered it?', target: 'login', label: 'Back to sign in' }
}

export function AuthScreen({ mode, setMode, busy, error, notice, inviteMessage, onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const strongPassword = mode === 'register' || mode === 'reset'
  const control = switches[mode]

  function switchMode(next: AuthMode) {
    setPassword('')
    setMode(next)
  }

  return <main className="auth-layout">
    <section className="auth-brand-panel">
      <div className="auth-brand">
        <span className="product-mark" aria-hidden="true"><span /><span /><span /></span>
        <span>API Documentation</span>
      </div>
      <div className="auth-brand-copy"><p className="auth-kicker">CLOUD WORKSPACE</p><h1>Shared API work, with a clear history.</h1><p>Browse endpoint contracts, follow workspace changes, and keep your team on the same reference.</p></div>
      <div className="auth-model" aria-label="Workspace structure">
        <div><span className="model-glyph model-workspace" />Workspace</div>
        <div className="model-level-one"><span className="model-glyph model-folder" />Collection</div>
        <div className="model-level-two"><span className="model-method">GET</span>Request</div>
        <div className="model-level-three"><span className="model-contract-mark" />Response contract</div>
      </div>
      <p className="auth-brand-foot">Desktop app and browser portal · one shared cloud workspace</p>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-wrap">
        <p className="page-eyebrow">API DOCUMENTATION CLOUD</p>
        <h2>{headings[mode]}</h2>
        <p className="auth-subtitle">{subtitles[mode]}</p>
        {inviteMessage && <div className="auth-invite-note" role="status">{inviteMessage}</div>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        <form className="auth-form" onSubmit={(event) => onSubmit(event, email, password)}>
          {mode !== 'reset' && <label className="cloud-field"><span>Email address</span><input autoComplete="email" autoFocus type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>}
          {mode !== 'forgot' && <label className="cloud-field"><span>{mode === 'reset' ? 'New password' : 'Password'}</span><input autoComplete={strongPassword ? 'new-password' : 'current-password'} autoFocus={mode === 'reset'} type="password" required minLength={strongPassword ? 10 : 1} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={strongPassword ? 'At least 10 characters' : 'Enter your password'} /></label>}
          {strongPassword && <p className="field-hint">Use at least 10 characters.</p>}
          {mode === 'login' && <p className="auth-forgot"><button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button></p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="cloud-button cloud-button-primary auth-submit" disabled={busy}>{busy ? busyLabels[mode] : submitLabels[mode]}</button>
        </form>
        {control && <p className="auth-switch">{control.prompt} <button type="button" onClick={() => switchMode(control.target)}>{control.label}</button></p>}
        <p className="auth-local-note">For local development, emails sent by the cloud API, including invitations and reset links, appear in Mailpit.</p>
      </div>
    </section>
  </main>
}
