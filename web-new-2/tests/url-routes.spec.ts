import { expect, test, type Page } from '@playwright/test'

// Synthetic fixtures only. Every endpoint answers from this file, so no real account or workspace is read.
const workspace = { id: 'test-workspace', name: 'Test API workspace', role: 'owner', createdAt: '2026-01-01', updatedAt: null }

// On phones the sidebar is a drawer. It opens for each choice and closes again after it, so both ends are awaited.
async function openItem(page: Page, group: string | null, item: string) {
 const phone = (page.viewportSize()?.width ?? 1440) < 768
 if (phone) {
   if ((await page.getByRole('dialog').count()) === 0) await page.getByTestId('portal-sidebar-trigger').click()
   await expect(page.getByRole('dialog')).toBeVisible()
 } else if (group && !(await page.getByTestId(item).isVisible())) {
   await page.getByTestId(`${group}-toggle`).click()
 }
 await page.getByTestId(item).click()
 if (phone) await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function mockPortal(page: Page) {
 await page.route('**/api/**', async route => {
 // Section URLs such as /w/:id/api/collections are page loads, not API calls.
 if (route.request().resourceType() === 'document') return route.continue()
 const path = new URL(route.request().url()).pathname
 if (path === '/api/me') {
 await route.fulfill({ json: { data: { user: { id: 'test-user', email: 'fixture@example.test', isAdmin: false } } } })
 return
 }
 let payload: unknown = {}
 if (path.endsWith('/sync/pull')) payload = { workspace: { ...workspace, tree: [{ id: 'test-folder', kind: 'folder', name: 'Users', children: [{ id: 'test-request', name: 'List users', kind: 'request', method: 'GET', url: '/users', documentation: 'Synthetic fixture documentation', body: '{}' }] }] } }
 else if (path.endsWith('/members')) payload = { members: [{ id: 'test-member', email: 'fixture@example.test', role: 'owner', joinedAt: '2026-01-01' }] }
 else if (path.endsWith('/sync/history')) payload = { commits: [{ id: 'test-commit', message: 'Test commit', authorEmail: 'fixture@example.test', createdAt: '2026-01-01' }] }
 else if (path.endsWith('/notifications')) payload = { notifications: [], unreadCount: 0 }
 else if (path === '/api/workspaces') payload = { workspaces: [workspace] }
 else if (path.endsWith('/mcp-keys')) payload = { keys: [], limit: 10 }
 else if (path.endsWith('/mcp-access')) payload = { workspaces: [] }
 else if (path.endsWith('/mcp-guide')) payload = { guide: { roles: [], version: 'test', guide: '' } }
 await route.fulfill({ json: { data: payload, meta: { nextCursor: null } } })
 })
}

test('each section has its own URL, and a request and its back button keep working', async ({ page }, info) => {
 test.setTimeout(90_000)
 const errors: string[] = []
 page.on('pageerror', error => errors.push(error.message))
 await mockPortal(page)

 // A shared link opens the section directly.
 await page.goto('/w/test-workspace/api/collections')
 await expect(page.getByTestId('workspace-view-container')).toBeVisible()
 
 await openItem(page, 'workspace-api-nav', 'workspace-history-nav')
 await expect(page).toHaveURL(/\/w\/test-workspace\/api\/history$/)
 await expect(page.getByTestId('workspace-commit-test-commit')).toBeVisible()

 await openItem(page, null, 'workspace-team-nav')
 await expect(page).toHaveURL(/\/w\/test-workspace\/team$/)

 await openItem(page, 'workspace-api-nav', 'workspace-collections-nav')
 await expect(page).toHaveURL(/\/w\/test-workspace\/api\/collections$/)
 await page.getByRole('button', { name: 'Expand Users' }).click()
 await page.getByTestId('collection-request-test-request').click()
 await expect(page).toHaveURL(/\/w\/test-workspace\/api\/collections\/test-request$/)

 // Reloading or opening the request link keeps the same request open.
 await page.reload()
 await expect(page.getByTestId('collection-detail-container')).toBeVisible()
 await expect(page.getByTestId('collection-detail-container')).toContainText('List users')

 // Back goes to the list without the request.
 await page.goBack()
 await expect(page).toHaveURL(/\/w\/test-workspace\/api\/collections$/)
 await expect(page.getByTestId('collection-detail-container')).toHaveCount(0)

 await page.goto('/settings/mcp')
 await expect(page.getByRole('heading', { name: 'My MCP keys' })).toBeVisible()
 expect(errors).toEqual([])
})
