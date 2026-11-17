import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createIssue, getIssue } from '@/services/issues'
import { updateProjectSettings } from '@/services/project-settings'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('project settings', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  async function freshProject(key: string) {
    const id = randomUUID()
    await world.db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${world.workspaceId}, ${key}, ${world.ownerId}, ${key})`
    await world.db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${id}, ${world.people.pm}, 'pm'), (${id}, ${world.people.lead}, 'tech_lead')`
    return { workspaceId: world.workspaceId, projectId: id }
  }
  const letters = () => randomUUID().replace(/[^a-f]/g, '').toUpperCase().slice(0, 6).padEnd(4, 'Z')

  test('the PM sets the key, the goal, and the mode', async () => {
    const scope = await freshProject(`OLD${letters()}`)
    const key = `NEW${letters()}`
    const settings = await updateProjectSettings(world.db, scope, world.as('pm'), { key, productGoal: '  Cut checkout time in half  ', mode: 'kanban' })
    expect(settings).toMatchObject({ key, productGoal: 'Cut checkout time in half', mode: 'kanban' })
  })

  test('an issue is read by its new key and by the key it had before', async () => {
    const oldKey = `AAA${letters()}`
    const scope = await freshProject(oldKey)
    const issue = await createIssue(world.db, scope, world.as('pm'), { type: 'task', title: 'Renamed project' })
    const newKey = `BBB${letters()}`
    await updateProjectSettings(world.db, scope, world.as('pm'), { key: newKey })
    expect((await getIssue(world.db, scope, world.as('pm'), `${newKey}-${issue.number}`)).id).toBe(issue.id)
    expect((await getIssue(world.db, scope, world.as('pm'), `${oldKey.toLowerCase()}-${issue.number}`)).id).toBe(issue.id)
    expect((await getIssue(world.db, scope, world.as('pm'), issue.id)).key).toBe(`${newKey}-${issue.number}`)
    await world.rejectsWith(() => getIssue(world.db, scope, world.as('pm'), `ZZZZ-${issue.number}`), 'ISSUE_NOT_FOUND')
  })

  test('a key must be 2 to 10 capital letters', async () => {
    const scope = await freshProject(`KEY${letters()}`)
    for (const key of ['a', 'ab', 'A1', 'ABCDEFGHIJK', '']) {
      await world.rejectsWith(() => updateProjectSettings(world.db, scope, world.as('pm'), { key }), 'PROJECT_INPUT_INVALID')
    }
  })

  test('a key used by another project, now or before, is taken', async () => {
    const first = await freshProject(`ONE${letters()}`)
    const second = await freshProject(`TWO${letters()}`)
    const firstKey = (await updateProjectSettings(world.db, first, world.as('pm'), {})).key
    await world.rejectsWith(() => updateProjectSettings(world.db, second, world.as('pm'), { key: firstKey }), 'PROJECT_KEY_TAKEN')
    const moved = `MOV${letters()}`
    await updateProjectSettings(world.db, first, world.as('pm'), { key: moved })
    await world.rejectsWith(() => updateProjectSettings(world.db, second, world.as('pm'), { key: firstKey }), 'PROJECT_KEY_TAKEN')
  })

  test('a project can take back a key it had before', async () => {
    const original = `ORG${letters()}`
    const scope = await freshProject(original)
    await updateProjectSettings(world.db, scope, world.as('pm'), { key: `TMP${letters()}` })
    expect((await updateProjectSettings(world.db, scope, world.as('pm'), { key: original })).key).toBe(original)
  })

  test('only the PM changes the settings, and an AI agent key does not', async () => {
    const scope = await freshProject(`ROL${letters()}`)
    await world.rejectsWith(() => updateProjectSettings(world.db, scope, world.as('lead'), { productGoal: 'x' }), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => updateProjectSettings(world.db, scope, world.as('plain'), { productGoal: 'x' }), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => updateProjectSettings(world.db, scope, world.agent('pm'), { productGoal: 'x' }), 'ISSUE_AGENT_FORBIDDEN')
  })

  test('the mode and the goal are checked', async () => {
    const scope = await freshProject(`CHK${letters()}`)
    await world.rejectsWith(() => updateProjectSettings(world.db, scope, world.as('pm'), { mode: 'waterfall' as never }), 'PROJECT_INPUT_INVALID')
    await world.rejectsWith(() => updateProjectSettings(world.db, scope, world.as('pm'), { productGoal: 'x'.repeat(2001) }), 'PROJECT_INPUT_INVALID')
  })
})
