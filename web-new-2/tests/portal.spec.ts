import { expect, test, type Page } from '@playwright/test'

// On phones a section click closes the drawer, so wait for it to finish closing before reopening.
async function openSection(page: Page, mobile: boolean, group: string | null, item: string) {
  if (mobile) {
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByTestId('portal-sidebar-trigger').click()
    await page.getByTestId(item).click()
    return
  }
  if (group) await page.getByTestId(`${group}-toggle`).click()
  await page.getByTestId(item).click()
}

async function openAccountMenu(page: Page, mobile: boolean) {
  if (mobile) {
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByTestId('portal-sidebar-trigger').click()
  }
  await page.getByTestId('portal-account-menu-trigger').click()
}

test('MVP navigation, create, request reading, sign-out and responsive layout', async ({ page }, info) => {
 const mobile = info.project.name === 'mobile'
 let signedIn = false
 const workspace = { id: 'test-workspace', name: 'Test API workspace', role: 'owner', createdAt: '2026-01-01', updatedAt: null }
 const errors: string[] = []
 page.on('pageerror', error => errors.push(error.message))
 await page.route('**/api/**', async route => {
 const path = new URL(route.request().url()).pathname
 let payload: unknown = {}
 if (path === '/api/me') { await route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { data: { user: { id: 'test-user', email: 'fixture@example.test' } } } : { error: 'Unauthenticated' } }); return }
 if (path.endsWith('/login')) signedIn = true
 else if (path.endsWith('/logout')) signedIn = false
 else if (path.endsWith('/sync/pull')) payload = { workspace: { ...workspace, tree: [{ id: 'test-folder', kind: 'folder', name: 'Users', children: [{ id: 'test-request', name: 'List users', kind: 'request', method: 'GET', url: '/users', documentation: 'Synthetic fixture documentation', body: '{}' }] }] } }
 else if (path.endsWith('/members')) payload = { members: [{ id: 'test-member', email: 'fixture@example.test', role: 'owner', joinedAt: '2026-01-01' }] }
 else if (path.endsWith('/sync/history')) payload = { commits: [{ id: 'test-commit', message: 'Test commit', authorEmail: 'fixture@example.test', createdAt: '2026-01-01' }] }
 else if (path.endsWith('/notifications')) payload = { notifications: [], unreadCount: 0 }
 else if (path === '/api/workspaces') payload = route.request().method() === 'POST' ? { workspace } : { workspaces: [workspace] }
 await route.fulfill({ json: { data: payload, meta: { nextCursor: null } } })
 })
 await page.goto('/')
 await page.getByTestId('auth-mode-button').click()
 await expect(page.getByTestId('auth-password-input')).toHaveCount(0)
 await page.getByTestId('auth-email-input').fill('fixture@example.test')
 await page.getByTestId('auth-submit-button').click()
 await expect(page.getByTestId('auth-success-message')).toBeVisible()
 await page.getByTestId('auth-mode-button').click()
 await page.getByTestId('auth-password-input').fill('synthetic-test-password')
 await page.getByTestId('auth-submit-button').click()
 await expect(page.getByTestId('workspace-row-test-workspace')).toBeVisible()
 await page.getByTestId('workspace-create-button').click()
 await page.getByTestId('workspace-cancel-button').click()
 await page.getByTestId('workspace-open-test-workspace').click()
 await expect(page.getByTestId('workspace-view-container')).toBeVisible()
 await openSection(page, mobile, 'workspace-api-nav', 'workspace-collections-nav')
 await page.getByRole('button', { name: 'Expand Users' }).click()
 await page.getByTestId('collection-request-test-request').click()
 await page.getByTestId('collection-documentation-tab').click()
 await expect(page.getByTestId('collection-documentation-content')).toContainText('Synthetic fixture documentation')
 await openSection(page, mobile, 'workspace-api-nav', 'workspace-history-nav')
 await expect(page.getByTestId('workspace-commit-test-commit')).toBeVisible()
 await openSection(page, mobile, null, 'workspace-team-nav')
 await expect(page.getByTestId(mobile ? 'workspace-member-card-test-member' : 'workspace-member-test-member')).toBeVisible()
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
 await page.screenshot({ path: `test-results/${info.project.name}-workspace.png`, fullPage: true })
 await openAccountMenu(page, mobile)
 await page.getByTestId('portal-logout-button').click()
 await expect(page.getByTestId('auth-submit-button')).toBeVisible()
 expect(errors).toEqual([])
})
test('connection errors offer retry', async ({ page }) => {
 await page.route('**/api/me', route => route.fulfill({ status: 503, json: { error: 'Test service unavailable' } }))
 await page.goto('/')
 await expect(page.getByTestId('portal-error-state')).toContainText('Test service unavailable')
 await page.getByTestId('portal-retry-button').click()
})
test('invite registration, password reset, empty workspace and keyboard dialog', async ({ page }) => {
 await page.route('**/api/**', route => route.fulfill({ status: route.request().url().endsWith('/me') ? 401 : 200, json: route.request().url().endsWith('/me') ? { error: 'Unauthenticated' } : { data: {} } }))
 await page.goto('/join?token=synthetic-invite')
 await expect(page.getByRole('heading', { name: 'Join your team' })).toBeVisible()
 await page.getByTestId('auth-email-input').fill('fixture@example.test')
 await page.getByTestId('auth-password-input').fill('synthetic-test-password')
 await page.getByTestId('auth-submit-button').click()
 await page.goto('/reset-password?token=synthetic-reset')
 await page.getByTestId('auth-password-input').fill('synthetic-test-password')
 await page.getByTestId('auth-submit-button').click()
 await expect(page.getByTestId('auth-success-message')).toContainText('Password updated')
 await page.getByTestId('auth-mode-button').click()
 await page.unroute('**/api/**')
 await page.route('**/api/**', route => {
   const url = route.request().url()
   const data = url.endsWith('/me')
     ? { user: { id: 'test', email: 'fixture@example.test' } }
     : url.includes('/notifications')
       ? { notifications: [], unreadCount: 0 }
       : { workspaces: [] }
   return route.fulfill({ json: { data, meta: { nextCursor: null } } })
 })
 await page.goto('/')
 await expect(page.getByTestId('portal-empty-state')).toBeVisible()
 await page.getByTestId('workspace-create-button').click()
 await page.keyboard.press('Escape')
 await expect(page.getByTestId('workspace-create-dialog')).not.toBeVisible()
})
