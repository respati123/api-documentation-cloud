import { expect, test, type Page } from '@playwright/test'

// Synthetic fixtures only. The workspace below belongs to nobody the admin signed in as.
const other = { id: 'ws-other', name: 'Partner API', ownerEmail: 'owner@example.test', memberCount: 3, createdAt: '2026-01-01T00:00:00.000Z' }

async function mockAdminWorkspaces(page: Page, isAdmin: boolean) {
 const searches: string[] = []
 await page.route('**/api/**', async route => {
 if (route.request().resourceType() === 'document') return route.continue()
 const url = new URL(route.request().url())
 const path = url.pathname
 if (path === '/api/me') return route.fulfill({ json: { data: { user: { id: 'admin-1', email: 'admin@example.test', isAdmin } } } })
 if (path === '/api/admin/workspaces') {
 searches.push(url.searchParams.get('q') ?? '')
 return route.fulfill({ json: { data: { workspaces: [other] }, meta: { nextCursor: null } } })
 }
 if (path.endsWith('/sync/pull')) {
 return route.fulfill({ json: { data: { workspace: { id: other.id, name: other.name, role: 'viewer', createdAt: other.createdAt, updatedAt: null, adminView: true, tree: [] } } } })
 }
 if (path === '/api/workspaces' || path.endsWith('/notifications')) return route.fulfill({ json: { data: { workspaces: [], notifications: [], unreadCount: 0 }, meta: { nextCursor: null } } })
 return route.fulfill({ json: { data: {}, meta: { nextCursor: null } } })
 })
 return searches
}

test('an admin lists every workspace, searches it, and opens one read-only', async ({ page }, info) => {
 const searches = await mockAdminWorkspaces(page, true)
 await page.goto('/admin/workspaces')
 await expect(page.getByTestId('admin-workspaces-table')).toBeVisible()
 await expect(page.getByTestId(`admin-workspace-${other.id}`)).toContainText('owner@example.test')

 await page.getByTestId('admin-workspaces-table-search').fill('Partner')
 await expect.poll(() => searches).toContain('Partner')

 await page.getByTestId(`admin-workspace-${other.id}`).getByTestId('admin-workspaces-table-row-actions').click()
 await page.getByTestId('admin-workspaces-table-action-open').click()
 await expect(page).toHaveURL(/\/w\/ws-other$/)
 await expect(page.getByTestId('workspace-admin-view-notice')).toContainText('not a member')
})

test('someone who is not an admin cannot open the workspace list', async ({ page }, info) => {
 await mockAdminWorkspaces(page, false)
 await page.goto('/admin/workspaces')
 await expect(page.getByTestId('admin-workspaces-nav')).toHaveCount(0)
 await expect(page.getByText('Admin access required')).toBeVisible()
 await expect(page.getByTestId('admin-workspaces-table')).toHaveCount(0)
})
