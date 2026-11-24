/**
 * Demo spec — what a solo visitor gets: their own copy of the demo session,
 * with the bundled audio and the seeded reviewer comments.
 *
 * It does not click "Make revision list": that would be a paid AI call, and
 * tests/revision.spec.ts covers it.
 *
 * Needs two test accounts (see tests/collab.spec.ts for how to create them).
 */

import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { BrowserContext } from '@playwright/test'

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
  return (await response.json()) as { success: boolean; data?: { trackId: string } }
}

test('a solo visitor opens the demo and finds a lived-in session', async ({ users }) => {
  const [visitor, stranger] = await users(2)

  // Start clean: an interrupted earlier run may have left this account a demo.
  const leftover = await callAction(visitor.context, 'openDemo', {})
  await callAction(visitor.context, 'deleteTrack', { trackId: leftover.data?.trackId })

  await visitor.page.goto('/tracks')
  await visitor.page.getByTestId('open-demo').click()
  await visitor.page.waitForURL(/\/t\/[0-9a-f-]{36}$/)
  const trackId = visitor.page.url().split('/t/')[1]

  try {
    await test.step('the session is already full of feedback', async () => {
      await expect(visitor.page.getByTestId('track-title')).toHaveText('Sekko - W (demo)')
      await expect(visitor.page.getByTestId('waveform')).toBeVisible()
      await expect(visitor.page.getByTestId('comment')).toHaveCount(9)
      for (const name of ['Maya (demo)', 'Dev (demo)', 'Jules (demo)']) {
        await expect(visitor.page.getByTestId('comment-list')).toContainText(name)
      }
    })

    await test.step('the visitor owns it: sharing and the revision list are there', async () => {
      await expect(visitor.page.getByTestId('share-button')).toBeVisible()
      await expect(visitor.page.getByTestId('make-revision-list')).toBeEnabled()
    })

    await test.step('the bundled audio is served to the owner and to nobody else', async () => {
      await expect(visitor.page.getByTestId('play-button')).toBeEnabled({ timeout: 15_000 })
      const audio = await visitor.context.request.get(`/api/tracks/${trackId}/audio`, {
        headers: await authHeaders(visitor.context),
      })
      expect(audio.status()).toBe(200)
      expect(audio.headers()['content-type']).toContain('audio/mpeg')

      // Press Play: the time readout leaves 0:00, so the file really decodes and plays.
      await visitor.page.getByTestId('play-button').click()
      await expect(visitor.page.getByText(/0:0[1-9] \/ 1:56/)).toBeVisible({ timeout: 15_000 })
      await visitor.page.getByTestId('play-button').click()

      const refused = await stranger.context.request.get(`/api/tracks/${trackId}/audio`, {
        headers: await authHeaders(stranger.context),
      })
      expect(refused.status()).toBe(404)
    })

    await test.step('there is one demo per user', async () => {
      expect(await callAction(visitor.context, 'openDemo', {})).toMatchObject({
        success: true,
        data: { trackId },
      })
      await visitor.page.goto('/tracks')
      await expect(visitor.page.getByTestId('track-list')).toContainText('Demo')
      await expect(visitor.page.getByTestId('open-demo')).toHaveCount(0)

      // The stranger's list is untouched: the demo is a private copy.
      await stranger.page.goto('/tracks')
      await expect(stranger.page.getByTestId('open-demo')).toBeVisible()
      await expect(stranger.page.getByText('Sekko - W (demo)')).toHaveCount(0)
    })
  } finally {
    expect(await callAction(visitor.context, 'deleteTrack', { trackId })).toMatchObject({ success: true })
  }

  // Deleted, so the offer is back.
  await visitor.page.goto('/tracks')
  await expect(visitor.page.getByTestId('open-demo')).toBeVisible()
})
