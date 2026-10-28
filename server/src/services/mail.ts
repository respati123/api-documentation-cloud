import nodemailer from 'nodemailer'
import type { AppConfig } from '@/config'

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function createMailer(config: AppConfig) {
  const { host, port, secure, user, password } = config.smtp
  if (!host) throw new Error('SMTP_HOST is not configured.')
  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && password ? { auth: { user, pass: password } } : {})
  })
}

export async function sendPasswordResetEmail(config: AppConfig, to: string, resetUrl: string): Promise<void> {
  await createMailer(config).sendMail({
    from: config.smtp.from,
    to,
    subject: 'Reset your API Documentation password',
    text: `We received a request to reset the password for your account.\n\nOpen this link to choose a new password. It expires in 1 hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset the password for your account.</p><p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`
  })
}

export async function sendInviteEmail(config: AppConfig, to: string, workspaceName: string, role: 'editor' | 'viewer', inviterEmail: string, inviteUrl: string): Promise<void> {
  const transporter = createMailer(config)
  const safeWorkspaceName = escapeHtml(workspaceName)
  const safeRole = escapeHtml(role)
  const safeInviterEmail = escapeHtml(inviterEmail)
  const safeInviteUrl = escapeHtml(inviteUrl)
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: `Invitation to ${workspaceName}`,
    text: `${inviterEmail} invited you to join ${workspaceName} with the ${role} role.\n\nThis invitation expires in 7 days. Open the API Documentation desktop app and use this invitation link:\n${inviteUrl}`,
    html: `<p><strong>${safeInviterEmail}</strong> invited you to join <strong>${safeWorkspaceName}</strong> with the <strong>${safeRole}</strong> role.</p><p>This invitation expires in 7 days.</p><p><a href="${safeInviteUrl}">Open invitation in API Documentation</a></p><p>If the link does not open the app, copy this link into the app's invitation field:<br><code>${safeInviteUrl}</code></p>`
  })
}
