import { describe, expect, test } from 'bun:test'
import { appRoleFor, workspaceAppAllowed } from '@/services/app-access'

describe('appRoleFor', () => {
  test('DBDesign: owner, backend, tech lead, and PM edit; other disciplines get nothing', () => {
    expect(appRoleFor('dbdesign', [{ role: 'owner', disciplines: [] }])).toBe('editor')
    expect(appRoleFor('dbdesign', [{ role: 'editor', disciplines: ['backend'] }])).toBe('editor')
    expect(appRoleFor('dbdesign', [{ role: 'editor', disciplines: ['pm'] }])).toBe('editor')
    expect(appRoleFor('dbdesign', [{ role: 'editor', disciplines: ['ui_ux', 'qa'] }])).toBe('none')
  })

  test('DBDesign: a viewer membership does not count', () => {
    expect(appRoleFor('dbdesign', [{ role: 'viewer', disciplines: ['backend'] }])).toBe('none')
  })

  test('Stitchkit: UI/UX edits, every other member reads, and a non-member has no access', () => {
    expect(appRoleFor('stitchkit', [{ role: 'editor', disciplines: ['ui_ux'] }])).toBe('editor')
    expect(appRoleFor('stitchkit', [{ role: 'owner', disciplines: [] }])).toBe('viewer')
    expect(appRoleFor('stitchkit', [{ role: 'editor', disciplines: ['backend'] }])).toBe('viewer')
    expect(appRoleFor('stitchkit', [{ role: 'viewer', disciplines: [] }])).toBe('viewer')
    expect(appRoleFor('stitchkit', [])).toBe('none')
  })

  test('Stitchkit: UI/UX in one workspace makes the account an editor everywhere', () => {
    const memberships = [
      { role: 'editor', disciplines: ['backend'] },
      { role: 'editor', disciplines: ['ui_ux'] },
    ]
    expect(appRoleFor('stitchkit', memberships)).toBe('editor')
  })
})

describe('workspaceAppAllowed', () => {
  test('DBDesign works for owner and the three roles, read or write', () => {
    expect(workspaceAppAllowed('dbdesign', 'owner', [], true)).toBe(true)
    expect(workspaceAppAllowed('dbdesign', 'editor', ['tech_lead'], false)).toBe(true)
    expect(workspaceAppAllowed('dbdesign', 'editor', ['frontend'], false)).toBe(false)
  })

  test('Stitchkit: anyone not a viewer reads, only UI/UX writes', () => {
    expect(workspaceAppAllowed('stitchkit', 'editor', ['frontend'], false)).toBe(true)
    expect(workspaceAppAllowed('stitchkit', 'editor', ['frontend'], true)).toBe(false)
    expect(workspaceAppAllowed('stitchkit', 'editor', ['ui_ux'], true)).toBe(true)
    expect(workspaceAppAllowed('stitchkit', 'owner', [], true)).toBe(false)
  })

  test('a viewer of the workspace is refused for both apps', () => {
    expect(workspaceAppAllowed('stitchkit', 'viewer', ['ui_ux'], false)).toBe(false)
    expect(workspaceAppAllowed('dbdesign', 'viewer', ['backend'], false)).toBe(false)
  })
})
