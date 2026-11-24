/**
 * Revision list spec — the AI checklist, with a real owner and a real reviewer.
 *
 * THIS TEST SPENDS MONEY: it makes one real AI call (well under a cent),
 * billed to the app owner. It makes exactly one; the second click in the test
 * is refused by the rate limit before any model is called. No email is sent:
 * test accounts are on the `.test` domain, which the app never emails.
 *
 * Each run also uses one of the owner test account's 20 lists per 24 hours.
 *
 * Needs two test accounts (see tests/collab.spec.ts for how to create them).
 * The test deletes the track it creates, including the uploaded file.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { BrowserContext } from '@playwright/test'

const TONE_WAV = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/tone.wav')
const WINDOW_MS = 5 * 60 * 1000

const usableTestAccounts = loadAllTestAccounts().length
test.skip(usableTestAccounts < 2, `Needs 2 usable test accounts, found ${usableTestAccounts}.`)

/** Headers that make an API call as the user signed in to this browser context. */
async function authHeaders(context: BrowserContext) {
  const response = await context.request.post('/api/auth/token')
  const { token } = (await response.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

/** Call a server action as the user signed in to this context; returns its JSON result. */
async function callAction(context: BrowserContext, name: string, data: Record<string, unknown>) {
  const response = await context.request.post(`/api/actions/${name}`, {
    headers: await authHeaders(context),
    data,
  })
  return (await response.json()) as { success: boolean; data?: Record<string, string>; error?: string }
}

test('the owner turns comments into a checklist; nobody else can', async ({ users }) => {
  test.setTimeout(240_000)
  const [owner, reviewer] = await users(2)

  // The rate limit works in fixed five-minute windows. Start with at least a
  // minute left in the current one, so both clicks below land in the same window.
  const leftInWindow = WINDOW_MS - (Date.now() % WINDOW_MS)
  if (leftInWindow < 60_000) await owner.page.waitForTimeout(leftInWindow)

  await owner.page.goto('/tracks')
  await owner.page.getByTestId('upload-input').setInputFiles(TONE_WAV)
  await owner.page.waitForURL(/\/t\/[0-9a-f-]{36}$/)
  const trackId = owner.page.url().split('/t/')[1]

  try {
    await test.step('with no comments there is nothing to make a list from', async () => {
      await expect(owner.page.getByTestId('make-revision-list')).toBeDisabled()
      expect(await callAction(owner.context, 'makeRevisionList', { trackId })).toMatchObject({
        success: false,
        error: 'There are no comments to work from yet.',
      })
    })

    await test.step('a reviewer joins and both leave comments', async () => {
      const invite = await callAction(owner.context, 'createInviteLink', { trackId })
      const joined = await callAction(reviewer.context, 'redeemInvite', { token: invite.data?.token })
      expect(joined).toMatchObject({ success: true })

      const comments = [
        { who: reviewer, timeSec: 1.0, body: 'The kick drum is far too loud in the intro.' },
        { who: owner, timeSec: 1.2, body: 'Agreed, the kick is drowning everything out here.' },
        { who: reviewer, timeSec: 5.0, body: 'The ending cuts off abruptly. It needs a fade out.' },
      ]
      for (const comment of comments) {
        const { who, timeSec, body } = comment
        expect(await callAction(who.context, 'addComment', { trackId, timeSec, body })).toMatchObject({
          success: true,
        })
      }
      await expect(owner.page.getByTestId('comment')).toHaveCount(3)
    })

    await test.step('a reviewer has no revision list, in the page or on the server', async () => {
      await reviewer.page.goto(`/t/${trackId}`)
      await expect(reviewer.page.getByTestId('comment')).toHaveCount(3)
      await expect(reviewer.page.getByTestId('revision-list')).toHaveCount(0)

      // Refused before the rate limit is touched or any model is called.
      expect(await callAction(reviewer.context, 'makeRevisionList', { trackId })).toMatchObject({
        success: false,
        error: 'Only the owner can make a revision list.',
      })
    })

    const items = owner.page.getByTestId('checklist-item')
    let itemCount = 0
    await test.step('the owner makes the list: items link back to their comments', async () => {
      await owner.page.getByTestId('make-revision-list').click()
      await expect(items.first()).toBeVisible({ timeout: 90_000 })
      await expect(owner.page.getByTestId('make-revision-list')).toHaveText('Make it again')

      // Three comments about two problems: at most three items, at least one.
      itemCount = await items.count()
      expect(itemCount).toBeLessThanOrEqual(3)
      for (const item of await items.all()) {
        await expect(item.getByTestId('checklist-source').first()).toBeVisible()
      }
      await expect(owner.page.getByTestId('revision-list')).toContainText(/kick|fade|ending/i)

      // A source link selects its comment in the comment list.
      await items.first().getByTestId('checklist-source').first().click()
      await expect(owner.page.locator('[data-testid="comment"].border-primary')).toHaveCount(1)

      // The reviewer still sees none of it.
      await expect(reviewer.page.getByTestId('checklist-item')).toHaveCount(0)
    })

    await test.step('a second list straight away is refused by the rate limit', async () => {
      await owner.page.getByTestId('make-revision-list').click()
      await expect(owner.page.getByText(/A revision list was just made for this track/)).toBeVisible()
      await expect(items).toHaveCount(itemCount)
    })

    await test.step('the owner can tick, reword and delete items, and it sticks', async () => {
      await items.first().getByTestId('checklist-checkbox').click()
      await expect(owner.page.getByTestId('revision-summary')).toContainText(`1 of ${itemCount} done`)

      // The ticked item moved to the bottom; reword it there.
      await items.last().getByRole('button', { name: 'Edit' }).click()
      await owner.page.getByLabel('Edit checklist item').fill('Turn the kick down 3 dB')
      await owner.page.getByRole('button', { name: 'Save' }).click()
      await expect(items.last()).toContainText('Turn the kick down 3 dB')

      // Reload: the tick and the new wording came from the server, not from this tab.
      await owner.page.reload()
      await expect(owner.page.getByTestId('revision-summary')).toContainText(`1 of ${itemCount} done`)
      await expect(items.last()).toContainText('Turn the kick down 3 dB')

      await items.last().getByRole('button', { name: 'Delete' }).click()
      await owner.page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await expect(items).toHaveCount(itemCount - 1)
    })

    await test.step('integrations cannot be called straight from a browser', async () => {
      const response = await owner.context.request.post('/api/integrations/email/send', {
        headers: await authHeaders(owner.context),
        data: { to: 'nobody@example.com', subject: 'x', text: 'x' },
      })
      expect(response.status()).toBe(404)
    })
  } finally {
    expect(await callAction(owner.context, 'deleteTrack', { trackId })).toMatchObject({ success: true })
  }
})
