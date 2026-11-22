import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'
import { createIssue, getIssue, updateIssue } from '@/services/issues'

// CLOUD-001 AC1: an epic is a feature with a code such as AUTH-001.
describe.skipIf(!databaseEnabled)('epic feature code', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  const epic = (title: string, featurePrefix?: string) => createIssue(world.db, world.scope, world.as('pm'), { type: 'epic', title, featurePrefix })

  test('a new epic takes the project key and the next number for it', async () => {
    const first = await epic('Reports')
    const second = await epic('Settings')
    expect(first.featureCode).toBe('TEST-001')
    expect(second.featureCode).toBe('TEST-002')
  })

  test('the PM picks a product area, and each area counts on its own', async () => {
    expect((await epic('Sign in', 'AUTH')).featureCode).toBe('AUTH-001')
    expect((await epic('Sign in with Google', 'AUTH')).featureCode).toBe('AUTH-002')
    expect((await epic('Budgets', 'BUDG')).featureCode).toBe('BUDG-001')
  })

  test('an epic opens by its feature code, in any case', async () => {
    const made = await epic('Notifications', 'NOTIF')
    expect((await getIssue(world.db, world.scope, world.as('pm'), 'NOTIF-001')).id).toBe(made.id)
    expect((await getIssue(world.db, world.scope, world.as('lead'), 'notif-001')).id).toBe(made.id)
  })

  test('a bad prefix, or a prefix on anything but an epic, is refused', async () => {
    await world.rejectsWith(() => epic('Lowercase', 'auth'), 'ISSUE_INPUT_INVALID')
    await world.rejectsWith(() => epic('Too long', 'AUTHENTIC'), 'ISSUE_INPUT_INVALID')
    await world.rejectsWith(() => createIssue(world.db, world.scope, world.as('pm'), { type: 'task', title: 'Task', featurePrefix: 'AUTH' }), 'ISSUE_INPUT_INVALID')
  })

  test('the PM renames the area and the epic takes the next free number there', async () => {
    const made = await epic('Export')
    const renamed = await updateIssue(world.db, world.scope, world.as('pm'), made.id, { featurePrefix: 'RPT' })
    expect(renamed.featureCode).toBe('RPT-001')
  })

  test('only the PM renames a feature code, and never through an agent key', async () => {
    const made = await epic('Import')
    await world.rejectsWith(() => updateIssue(world.db, world.scope, world.as('lead'), made.id, { featurePrefix: 'IMP' }), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => updateIssue(world.db, world.scope, world.agent('pm'), made.id, { featurePrefix: 'IMP' }), 'ROLE_NOT_ALLOWED')
  })

  test('a task has no feature code', async () => {
    const task = await createIssue(world.db, world.scope, world.as('pm'), { type: 'task', title: 'Plain task' })
    expect(task.featureCode).toBeNull()
  })
})
