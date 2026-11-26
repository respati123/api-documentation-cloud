import { expect, test, type Page } from '@playwright/test'

// Synthetic fixtures: a long collection and a long response body, so both panels overflow.
const workspace = { id: 'test-workspace', name: 'Test API workspace', role: 'owner', createdAt: '2026-01-01', updatedAt: null }
const example = JSON.stringify({ items: Array.from({ length: 120 }, (_, index) => ({ id: index, name: `item ${index}` })) }, null, 2)
const requests = Array.from({ length: 60 }, (_, index) => ({
 id: `request-${index}`,
 kind: 'request',
 name: `Request ${index}`,
 method: 'GET',
 url: `/items/${index}`,
 body: '{}',
 responses: [{ id: `response-${index}`, statusCode: '200', description: 'OK', content: [{ id: `content-${index}`, mediaType: 'application/json', schema: '{}', example }] }],
}))

async function mockPortal(page: Page) {
 await page.route('**/api/**', async route => {
 if (route.request().resourceType() === 'document') return route.continue()
 const path = new URL(route.request().url()).pathname
 if (path === '/api/me') return route.fulfill({ json: { data: { user: { id: 'test-user', email: 'fixture@example.test', isAdmin: false } } } })
 let payload: unknown = {}
 if (path.endsWith('/sync/pull')) payload = { workspace: { ...workspace, tree: [{ id: 'test-folder', kind: 'folder', name: 'Users', children: requests }] } }
 else if (path === '/api/workspaces') payload = { workspaces: [workspace] }
 else if (path.endsWith('/notifications')) payload = { notifications: [], unreadCount: 0 }
 await route.fulfill({ json: { data: payload, meta: { nextCursor: null } } })
 })
}

test('long lists and long bodies scroll inside their own panels', async ({ page }, info) => {
 test.setTimeout(90_000)
 await mockPortal(page)
 await page.goto('/w/test-workspace/api/collections')
 if (!(await page.getByRole('dialog').isVisible()) && (await page.getByTestId('portal-sidebar-trigger').isVisible())) await page.getByTestId('portal-sidebar-trigger').click()
 if (!(await page.getByTestId('workspace-collections-nav').isVisible())) await page.getByTestId('workspace-api-nav-toggle').click()
 await page.getByTestId('workspace-collections-nav').click()
 await page.getByRole('button', { name: 'Expand Users' }).click()
 await page.getByTestId('collection-request-request-0').click()

 const tree = page.getByTestId('collections-tree-scroll').locator('[data-slot="scroll-area-viewport"]').first()
 const detail = page.getByTestId('collections-detail-scroll').locator('[data-slot="scroll-area-viewport"]').first()
 for (const viewport of [tree, detail]) {
 const overflows = await viewport.evaluate(element => element.scrollHeight > element.clientHeight)
 expect(overflows).toBe(true)
 }

 // The bar is hidden while nothing scrolls, shows during a scroll, then fades out again.
 // Radix removes the bar from the page while it is hidden, so idle means no bar element.
 const bar = page.getByTestId('collections-tree-scroll').locator('[data-slot="scroll-area-scrollbar"]')
 await expect(bar).toHaveCount(0)
 await tree.hover()
 await page.mouse.wheel(0, 300)
 await expect(bar).toHaveAttribute('data-state', 'visible')
 await expect(bar).toHaveCount(0, { timeout: 3000 })
})
