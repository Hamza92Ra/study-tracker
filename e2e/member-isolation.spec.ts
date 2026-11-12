import { test, expect } from '@playwright/test'

test.skip(!process.env.E2E_MEMBER_USERNAME || !process.env.E2E_MEMBER_PASSWORD,
  'Requires members seeded in isolated CI PostgreSQL')

test('public profiles expose only explicitly published sessions and respect private settings', async ({ page }) => {
  await page.goto('/u/ci_member')
  await expect(page.getByText('Published CI Member Session').first()).toBeVisible()
  await expect(page.getByText('Hidden CI Member Session')).toHaveCount(0)
  await page.goto('/u/ci_member/activity')
  await expect(page.getByText('Published CI Member Session').first()).toBeVisible()
  await expect(page.getByText('Hidden CI Member Session')).toHaveCount(0)
  await page.goto('/u/ci_private')
  await expect(page.locator('body')).toContainText('Page not found')
  await page.goto('/u/ci_private/activity')
  await expect(page.locator('body')).toContainText('Page not found')
})

test('member can use their own Spotify and public profile but cannot access People', async ({ page }) => {
  await page.goto('/manage/login')
  await page.getByLabel('Username or email').fill(process.env.E2E_MEMBER_USERNAME!)
  await page.getByLabel('Password').fill(process.env.E2E_MEMBER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/manage$/, { timeout: 45000 })
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View public site' })).toHaveAttribute('href', '/u/ci_member')
  await expect(page.getByText('Connect your Spotify profile')).toBeVisible()
  await expect(page.getByText('Account linking requires Spotify app setup')).toBeVisible()

  await page.getByLabel('Name', { exact: true }).fill('CI member soundtrack')
  await page.getByLabel('Spotify link').fill('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTitle('Spotify playlist: CI member soundtrack')).toBeVisible()
  await page.getByRole('button', { name: 'Remove selected Spotify link' }).click()
  await expect(page.getByTitle('Spotify playlist: CI member soundtrack')).toHaveCount(0)

  await page.goto('/manage/admin')
  await expect(page.locator('body')).toContainText('Page not found')

  await page.goto('/manage/settings')
  // Wait for the settings form to hydrate before typing; otherwise React Hook Form
  // may replace the typed username with its initial default value.
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ci_member')
  const updatedName = 'ci_member_renamed'
  await page.getByLabel('Username', { exact: true }).fill(updatedName)
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('link', { name: 'View public site' })).toHaveAttribute('href', '/u/ci_member_renamed')
  await expect(page.getByText('Your public URL: /u/ci_member_renamed')).toBeVisible()
  await page.goto('/u/ci_member_renamed')
  await expect(page.getByText('Published CI Member Session').first()).toBeVisible()
  await page.goto('/u/ci_member')
  await expect(page.locator('body')).toContainText('Page not found')
})
