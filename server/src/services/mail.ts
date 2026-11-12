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

// The invite link opens the portal. After signing in there, the workspace shows in the desktop app on its next sign-in.
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
  const transporter = createMailer(config)
  const message = inviteMessage({ workspaceName, role, inviterEmail, inviteUrl })
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: `Invitation to ${workspaceName}`,
    text: message.text,
    html: message.html,
  })
}

// The link opens the member's MCP page. The key is claimed there while signed in, so the email carries no secret.
export function mcpKeyMessage(key: { keyName: string; claimUrl: string; claimDays: number }) {
  const safeKeyName = escapeHtml(key.keyName)
  const safeClaimUrl = escapeHtml(key.claimUrl)
  return {
    text: `An MCP key named "${key.keyName}" is ready for you.\n\nOpen this link, sign in, and claim it within ${key.claimDays} days. The key is shown once, when you claim it:\n${key.claimUrl}`,
    html: `<p>An MCP key named <strong>${safeKeyName}</strong> is ready for you.</p><p><a href="${safeClaimUrl}">Open the MCP page</a>, sign in, and claim it within ${key.claimDays} days.</p><p>The key is shown once, when you claim it.</p>`,
  }
}

export async function sendMcpKeyEmail(config: AppConfig, to: string, keyName: string, claimUrl: string, claimDays: number): Promise<void> {
  const message = mcpKeyMessage({ keyName, claimUrl, claimDays })
  await createMailer(config).sendMail({ from: config.smtp.from, to, subject: 'Your MCP key is ready to claim', text: message.text, html: message.html })
}
