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

export async function sendUserInviteEmail(config: AppConfig, to: string, inviterEmail: string, inviteUrl: string): Promise<void> {
  const safeInviterEmail = escapeHtml(inviterEmail)
  const safeInviteUrl = escapeHtml(inviteUrl)
  await createMailer(config).sendMail({
    from: config.smtp.from,
    to,
    subject: 'Invitation to API Documentation',
    text: `${inviterEmail} invited you to API Documentation.\n\nOpen this link to set your password and activate your account. It expires in 7 days:\n${inviteUrl}`,
    html: `<p><strong>${safeInviterEmail}</strong> invited you to API Documentation.</p><p><a href="${safeInviteUrl}">Set your password and activate your account</a></p><p>This invitation expires in 7 days.</p>`,
  })
}

export function inviteMessage(invite: { workspaceName: string; role: 'editor' | 'viewer'; inviterEmail: string; inviteUrl: string }) {
  const safeWorkspaceName = escapeHtml(invite.workspaceName)
  const safeRole = escapeHtml(invite.role)
  const safeInviterEmail = escapeHtml(invite.inviterEmail)
  const safeInviteUrl = escapeHtml(invite.inviteUrl)
  return {
    text: `${invite.inviterEmail} invited you to join ${invite.workspaceName} with the ${invite.role} role.\n\nThis invitation expires in 7 days. Open this link to accept it, then sign in:\n${invite.inviteUrl}\n\nThe workspace then appears in the API Documentation desktop app the next time you sign in there.`,
    html: `<p><strong>${safeInviterEmail}</strong> invited you to join <strong>${safeWorkspaceName}</strong> with the <strong>${safeRole}</strong> role.</p><p>This invitation expires in 7 days.</p><p><a href="${safeInviteUrl}">Open invitation</a></p><p>After you sign in, the workspace appears in the API Documentation desktop app the next time you sign in there.</p>`,
  }
}

export async function sendInviteEmail(config: AppConfig, to: string, workspaceName: string, role: 'editor' | 'viewer', inviterEmail: string, inviteUrl: string): Promise<void> {
  const message = inviteMessage({ workspaceName, role, inviterEmail, inviteUrl })
  await createMailer(config).sendMail({ from: config.smtp.from, to, subject: `Invitation to ${workspaceName}`, ...message })
}
