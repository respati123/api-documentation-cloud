import { describe, expect, test } from 'bun:test'
import { inviteMessage } from '@/services/mail'

const invite = {
  workspaceName: 'Platform API',
  role: 'editor' as const,
  inviterEmail: 'owner@example.test',
  inviteUrl: 'https://docs.respati.web.id/invite?token=abc123',
}

describe('invite email', () => {
  test('the text names the link the recipient can open, and that link is the portal invite page', () => {
    const { text } = inviteMessage(invite)
    expect(text).toContain(invite.inviteUrl)
    expect(text).toContain('Open this link')
  })

  test('the email does not tell the recipient to paste the portal link into the desktop app, which only reads api-docs:// links or the bare token', () => {
    const { text, html } = inviteMessage(invite)
    expect(text).not.toContain('desktop app and use this invitation link')
    expect(html).not.toContain('copy this link into the app')
  })
})
