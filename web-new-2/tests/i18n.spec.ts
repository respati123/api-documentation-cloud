import { expect, test } from '@playwright/test'

test('language switch persists across reload and updates the document language', async ({ page }) => {
 await page.route('**/api/**', route => route.fulfill({ status: 401, json: { error: 'Unauthenticated' } }))
 await page.goto('/')
 await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
 await expect(page.locator('html')).toHaveAttribute('lang', 'en')

 await page.getByTestId('language-select').click()
 await page.getByRole('option', { name: 'Bahasa Indonesia' }).click()
 await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible()
 await expect(page.locator('html')).toHaveAttribute('lang', 'id')

 await page.reload()
 await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible()

 await page.getByTestId('language-select').click()
 await page.getByRole('option', { name: 'English' }).click()
 await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
 await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
