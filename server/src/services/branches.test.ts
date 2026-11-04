import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { ErrorCode } from '@/lib/errors/codes'
import { AppError } from '@/lib/errors/app-error'
import { insertCommit, listCommitsPage } from '@/repositories/commits.repository'
import { insertMembership } from '@/repositories/memberships.repository'
import { findBranch, listBranches } from '@/repositories/branches.repository'
import { insertWorkspace } from '@/repositories/workspaces.repository'
import { branchHistoryPage, createBranch, ensureCollectionBranches, listBranchesFor, pullBranch, pushBranch } from '@/services/branches'
import { databaseEnabled, openTestDatabase, seedUser } from '@/testing/database'
import type { AuthUser, TreeNode } from '@/models/workspace'

const folder = (id: string, name: string): TreeNode => ({ id, kind: 'folder', name, children: [] })
const variables = { globals: [], environments: [] }

// A workspace whose head already holds two top-level collections, as workspaces created before branches do.
async function seedLegacyWorkspace(db: SQL, owner: AuthUser) {
  const workspaceId = randomUUID()
  const headId = randomUUID()
  await insertWorkspace(db, { id: workspaceId, name: `Branches ${workspaceId.slice(0, 8)}`, ownerId: owner.id, headCommitId: headId })
  await insertMembership(db, { workspaceId, userId: owner.id, role: 'owner' })
  await insertCommit(db, {
    id: headId,
    workspaceId,
    authorId: owner.id,
    parentIds: [],
    message: 'Legacy head',
    snapshot: { tree: [folder('users', 'Users'), folder('orders', 'Orders')], variables },
  })
  return { workspaceId, headId }
}

async function userWithRole(db: SQL, workspaceId: string, role: 'editor' | 'viewer') {
  const user = await seedUser(db)
  await insertMembership(db, { workspaceId, userId: user.id, role })
  return { id: user.id, email: user.email } satisfies AuthUser
}

async function expectAppError(promise: Promise<unknown>, code: ErrorCode) {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  expect(error).toBeInstanceOf(AppError)
  expect((error as AppError).code).toBe(code)
  return error as AppError
}

describe.skipIf(!databaseEnabled)('collection branches', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('the first use splits the head into one main branch per collection, and only once', async () => {
    const owner = await seedUser(db)
    const { workspaceId } = await seedLegacyWorkspace(db, { id: owner.id, email: owner.email })

    await ensureCollectionBranches(db, workspaceId)
    await ensureCollectionBranches(db, workspaceId)

    const branches = await listBranches(db, workspaceId)
    expect(branches.map((branch) => [branch.collectionKey, branch.name]).sort()).toEqual([
      ['orders', 'main'],
      ['users', 'main'],
    ])
    for (const branch of branches) {
      const page = await branchHistoryPage(db, workspaceId, branch.id, { id: owner.id, email: owner.email }, 10, null)
      expect(page.items.length).toBe(1)
    }
  })

  test('a branch push that reuses a commit id from another workspace is refused, and the branch head does not move', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const other = await seedLegacyWorkspace(db, owner)
    const mine = await seedLegacyWorkspace(db, owner)
    await ensureCollectionBranches(db, mine.workspaceId)
    const branch = (await listBranches(db, mine.workspaceId)).find((item) => item.collectionKey === 'users')
    if (!branch) throw new Error('The users branch was not created.')

    await expectAppError(
      pushBranch(db, mine.workspaceId, branch.id, owner, [{ id: other.headId, parentIds: [branch.headCommitId ?? ''], message: 'steal', tree: [folder('users', 'Users')] }]),
      'PUSH_COMMIT_INVALID',
    )
    expect((await findBranch(db, mine.workspaceId, branch.id))?.headCommitId).toBe(branch.headCommitId)
  })

  test('a new branch starts at its collection’s main head and a name is unique per collection', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const { workspaceId } = await seedLegacyWorkspace(db, owner)
    const main = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'users' && branch.name === 'main')
    if (!main) throw new Error('main branch missing')

    const feature = await createBranch(db, workspaceId, owner, { collectionKey: 'users', name: 'add-login' })
    expect(feature.headCommitId).toBe(main.headCommitId)

    await expectAppError(createBranch(db, workspaceId, owner, { collectionKey: 'users', name: 'add-login' }), 'BRANCH_NAME_TAKEN')
    await expectAppError(createBranch(db, workspaceId, owner, { collectionKey: 'users', name: '   ' }), 'BRANCH_NAME_INVALID')
    await expectAppError(createBranch(db, workspaceId, owner, { collectionKey: 'missing', name: 'x' }), 'BRANCH_COLLECTION_NOT_FOUND')
  })

  test('a push moves only its own branch, and the workspace head is left alone', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const { workspaceId, headId } = await seedLegacyWorkspace(db, owner)
    const usersMain = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'users' && branch.name === 'main')
    const ordersMain = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'orders' && branch.name === 'main')
    if (!usersMain || !ordersMain) throw new Error('main branches missing')

    const commitId = randomUUID()
    await pushBranch(db, workspaceId, usersMain.id, owner, [{ id: commitId, parentIds: [usersMain.headCommitId], message: 'Add user list', tree: [folder('users', 'Users v2')] }])

    expect((await findBranch(db, workspaceId, usersMain.id))?.headCommitId).toBe(commitId)
    expect((await findBranch(db, workspaceId, ordersMain.id))?.headCommitId).toBe(ordersMain.headCommitId)
    const workspaceHead = await db`SELECT head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId}`
    expect(workspaceHead[0].headCommitId).toBe(headId)
  })

  test('a push from an old head is refused, and the remote head is returned', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const { workspaceId } = await seedLegacyWorkspace(db, owner)
    const ordersMain = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'orders' && branch.name === 'main')
    if (!ordersMain) throw new Error('main branch missing')
    await pushBranch(db, workspaceId, ordersMain.id, owner, [{ id: randomUUID(), parentIds: [ordersMain.headCommitId], message: 'First', tree: [folder('orders', 'Orders v2')] }])

    const stale = await expectAppError(
      pushBranch(db, workspaceId, ordersMain.id, owner, [{ id: randomUUID(), parentIds: [ordersMain.headCommitId], message: 'Stale', tree: [folder('orders', 'Orders v3')] }]),
      'SYNC_REMOTE_ADVANCED',
    )
    expect((stale.details as { remote: { message: string } | null }).remote?.message).toBe('First')
  })

  test('a push must carry only its own collection', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const { workspaceId } = await seedLegacyWorkspace(db, owner)
    const usersMain = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'users' && branch.name === 'main')
    if (!usersMain) throw new Error('main branch missing')

    await expectAppError(
      pushBranch(db, workspaceId, usersMain.id, owner, [{ id: randomUUID(), parentIds: [usersMain.headCommitId], message: 'Wrong', tree: [folder('orders', 'Orders')] }]),
      'PUSH_COMMIT_INVALID',
    )
  })

  test('a viewer can read a branch but cannot create or push one', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const { workspaceId } = await seedLegacyWorkspace(db, owner)
    const viewer = await userWithRole(db, workspaceId, 'viewer')
    const usersMain = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'users' && branch.name === 'main')
    if (!usersMain) throw new Error('main branch missing')

    const pulled = await pullBranch(db, workspaceId, usersMain.id, viewer)
    expect(pulled.tree.map((node) => node.id)).toEqual(['users'])
    await expectAppError(createBranch(db, workspaceId, viewer, { collectionKey: 'users', name: 'nope' }), 'ROLE_NOT_ALLOWED')
    await expectAppError(
      pushBranch(db, workspaceId, usersMain.id, viewer, [{ id: randomUUID(), parentIds: [usersMain.headCommitId], message: 'Nope', tree: [folder('users', 'U')] }]),
      'ROLE_NOT_ALLOWED',
    )
  })

  test('branch commits stay out of the workspace history', async () => {
    const owner = { id: (await seedUser(db)).id, email: 'owner@test.dev' }
    const { workspaceId } = await seedLegacyWorkspace(db, owner)
    const usersMain = (await listBranchesFor(db, workspaceId, owner)).find((branch) => branch.collectionKey === 'users' && branch.name === 'main')
    if (!usersMain) throw new Error('main branch missing')
    await pushBranch(db, workspaceId, usersMain.id, owner, [{ id: randomUUID(), parentIds: [usersMain.headCommitId], message: 'Branch only', tree: [folder('users', 'U')] }])

    const workspaceHistory = await listCommitsPage(db, { workspaceId, after: null, limit: 50 })
    expect(workspaceHistory.map((commit) => commit.message)).toEqual(['Legacy head'])
    const branchHistory = await branchHistoryPage(db, workspaceId, usersMain.id, owner, 50, null)
    expect(branchHistory.items.map((commit) => commit.message)).toContain('Branch only')
  })
})
