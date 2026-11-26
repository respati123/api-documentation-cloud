import { expect, test, type Page } from '@playwright/test'

// Synthetic fixtures only. The calls the admin page makes are recorded so the test can check the request bodies.
const roles = [{ id: 'role-developer', name: 'developer' }, { id: 'role-qa', name: 'qa' }]
const users = [{ id: 'user-sam', email: 'sam@example.test', name: 'Sam Rivera', isAdmin: false, roles: ['role-developer'], createdAt: '2026-01-01T00:00:00.000Z' }]
const invites = [{ id: 'invite-old', email: 'old@example.test', expiresAt: '2027-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', createdByEmail: 'admin@example.test' }]

async function mockAdmin(page: Page, isAdmin: boolean) {
 const calls: Array<{ method: string; path: string; body: unknown }> = []
 await page.route('**/api/**', async route => {
 if (route.request().resourceType() === 'document') return route.continue()
 const request = route.request()
 const path = new URL(request.url()).pathname
 const body = request.postData() ? JSON.parse(request.postData()!) : undefined
 if (path !== '/api/me') calls.push({ method: request.method(), path, body })
 if (path === '/api/me') return route.fulfill({ json: { data: { user: { id: 'admin-1', email: 'admin@example.test', isAdmin } } } })
 if (path === '/api/admin/users' && request.method() === 'GET') return route.fulfill({ json: { data: { users }, meta: { nextCursor: null, total: users.length } } })
 if (path === '/api/admin/users/user-sam' && request.method() === 'PATCH') return route.fulfill({ json: { data: { user: { id: 'user-sam', roles: body.roles } } } })
 if (path === '/api/admin/roles' && request.method() === 'GET') return route.fulfill({ json: { data: { roles } } })
 if (path === '/api/admin/roles' && request.method() === 'POST') return route.fulfill({ json: { data: { id: 'role-designer', name: body.name } } })
 if (path === '/api/admin/user-invites' && request.method() === 'GET') return route.fulfill({ json: { data: { invites }, meta: { nextCursor: null, total: invites.length } } })
 if (path === '/api/admin/user-invites' && request.method() === 'POST') return route.fulfill({ json: { data: { id: 'invite-new', email: body.email, token: 'synthetic-token', inviteUrl: 'https://docs.example.test/join?token=synthetic-token', expiresInDays: 7, emailSent: false } } })
 if (path === '/api/admin/user-invites/invite-old' && request.method() === 'DELETE') return route.fulfill({ status: 204, body: '' })
 if (path === '/api/workspaces') return route.fulfill({ json: { data: { workspaces: [] }, meta: { nextCursor: null } } })
 if (path.endsWith('/notifications')) return route.fulfill({ json: { data: { notifications: [], unreadCount: 0 }, meta: { nextCursor: null } } })
 return route.fulfill({ json: { data: {}, meta: { nextCursor: null } } })
 })
 return calls
}

test('an admin manages accounts, invitations, and roles from the Admin menu', async ({ page }, info) => {
 const calls = await mockAdmin(page, true)
 await page.goto('/admin/users')
 await expect(page.getByTestId('admin-users-table')).toBeVisible()
 await expect(page.getByTestId('admin-user-user-sam')).toContainText('developer')

 // Change roles: the saved list holds role ids.
 await page.getByTestId('admin-user-user-sam').getByTestId('admin-users-table-row-actions').click()
 await page.getByTestId('admin-users-table-action-roles').click()
 await page.getByTestId('admin-edit-role-role-qa').click()
 await page.getByTestId('admin-edit-roles-save').click()
 await expect(page.getByTestId('admin-edit-roles-dialog')).toHaveCount(0)
 expect(calls).toContainEqual({ method: 'PATCH', path: '/api/admin/users/user-sam', body: { roles: ['role-developer', 'role-qa'] } })

 // Make the account an app admin from the same dialog.
 await page.getByTestId('admin-user-user-sam').getByTestId('admin-users-table-row-actions').click()
 await page.getByTestId('admin-users-table-action-roles').click()
 await page.getByTestId('admin-edit-app-admin').click()
 await page.getByTestId('admin-edit-roles-save').click()
 await expect(page.getByTestId('admin-edit-roles-dialog')).toHaveCount(0)
 expect(calls).toContainEqual({ method: 'PATCH', path: '/api/admin/users/user-sam', body: { roles: ['role-developer'], isAdmin: true } })

 // Invite: without email setup the link is shown to copy.
 await page.getByTestId('admin-users-tab-invitations').click()
 await page.getByTestId('admin-invite-open').click()
 await page.getByTestId('admin-invite-email').fill('new@example.test')
 await page.getByTestId('admin-invite-submit').click()
 await expect(page.getByTestId('admin-invite-link')).toHaveValue('https://docs.example.test/join?token=synthetic-token')
 expect(calls).toContainEqual({ method: 'POST', path: '/api/admin/user-invites', body: { email: 'new@example.test' } })
 await page.getByRole('button', { name: 'Done' }).click()

 // Cancel a pending invitation.
 await page.getByTestId('admin-invite-invite-old').getByTestId('admin-invites-table-row-actions').click()
 await page.getByTestId('admin-invites-table-action-cancel').click()
 expect(calls.some(call => call.method === 'DELETE' && call.path === '/api/admin/user-invites/invite-old')).toBe(true)

 // Create a role from the Roles tab.
 await page.getByTestId('admin-users-tab-roles').click()
 await page.getByTestId('admin-role-create-open').click()
 await page.getByTestId('admin-role-name-input').fill('designer')
 await page.getByTestId('admin-role-create-button').click()
 expect(calls).toContainEqual({ method: 'POST', path: '/api/admin/roles', body: { name: 'designer' } })
})

test('someone who is not an admin does not see the Admin menu or the page', async ({ page }, info) => {
 await mockAdmin(page, false)
 await page.goto('/admin/users')
 await expect(page.getByTestId('admin-users-nav')).toHaveCount(0)
 await expect(page.getByText('Admin access required')).toBeVisible()
 await expect(page.getByTestId('admin-users-table')).toHaveCount(0)
})
