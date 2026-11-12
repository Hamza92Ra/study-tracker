import { test, expect } from '@playwright/test'

test.skip(!process.env.E2E_OWNER_USERNAME || !process.env.E2E_OWNER_PASSWORD, 'Requires a migrated local database and E2E owner credentials')

test('owner manages a subject and published study session', async ({ page }) => {
  test.setTimeout(120000)
  const suffix = Date.now().toString()
  const subject = `E2E Subject ${suffix}`
  const session = `Session ${suffix}`
  const edited = `Edited ${session}`

  await page.goto('/manage')
  await expect(page).toHaveURL(/\/manage\/login/)
  await page.getByLabel('Username or email').fill(process.env.E2E_OWNER_USERNAME!)
  await page.getByLabel('Password').fill(process.env.E2E_OWNER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/manage$/, { timeout: 45000 })
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible()
  await page.goto('/manage/settings')
  // React Hook Form initializes this field during hydration, not at initial navigation.
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(process.env.E2E_OWNER_USERNAME!)
  const originalUsername = await page.getByLabel('Username', { exact: true }).inputValue()
  const changedUsername = `e2e_${suffix}`
  await page.getByLabel('Username', { exact: true }).fill(changedUsername)
  await page.getByLabel('Profile visibility').selectOption('public')
  await page.getByRole('button', { name: 'Save settings' }).click()
  // Sidebar href only updates after saveSettings commits and router.refresh runs.
  await expect(page.getByRole('link', { name: 'View public site' })).toHaveAttribute('href', `/u/${changedUsername}`)
  await expect(page.getByText(`Your public URL: /u/${changedUsername}`)).toBeVisible()
  await page.getByLabel('Username', { exact: true }).fill(originalUsername)
  await page.getByRole('button', { name: 'Save settings' }).click()
  // Wait for the server action and sidebar revalidation; never navigate during a save.
  await expect(page.getByRole('link', { name: 'View public site' })).toHaveAttribute('href', `/u/${originalUsername}`)
  const publicUrl = `/u/${originalUsername}`

  await page.goto('/manage')
  await page.getByLabel('Name', { exact: true }).fill(`Focus ${suffix}`)
  await page.getByLabel('Spotify link').fill('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTitle(`Spotify playlist: Focus ${suffix}`)).toBeVisible()
  await page.getByRole('button', { name: 'Remove selected Spotify link' }).click()

  await page.goto('/manage/subjects')
  await page.getByRole('button', { name: 'New subject' }).click()
  await page.getByLabel('Name', { exact: true }).fill(subject)
  await page.getByRole('button', { name: 'Save subject' }).click()
  await expect(page.getByRole('heading', { name: subject })).toBeVisible()
  await page.getByRole('button', { name: `Archive ${subject}` }).click()
  await expect(page.getByRole('button', { name: `Restore ${subject}` })).toBeVisible()
  await page.getByRole('button', { name: `Restore ${subject}` }).click()

  await page.goto('/manage/sessions')
  await page.getByRole('button', { name: 'New session' }).click()
  await page.getByLabel('Title', { exact: true }).fill(session)
  await page.getByRole('dialog').getByLabel('Subject', { exact: true }).selectOption({ label: subject })
  await page.getByLabel('Or enter duration manually (minutes)').fill('30')
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText(session)).toBeVisible()

  await page.goto(publicUrl)
  if (!await page.getByText(session).count()) {
    console.info('Public overview check:', (await page.locator('body').innerText()).slice(0, 1500))
  }
  await expect(page.getByText(session)).toBeVisible()
  await page.goto(`${publicUrl}/activity`)
  await expect(page.getByText(session)).toBeVisible()

  await page.goto('/manage/sessions')
  await page.getByRole('button', { name: `Edit ${session}` }).click()
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill(edited)
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText(edited)).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: `Delete ${edited}` }).click()
  await expect(page.getByText(edited)).toBeHidden()

  await page.goto('/manage/subjects')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: `Delete ${subject}` }).click()
  await expect(page.getByRole('heading', { name: subject })).toBeHidden()
})
