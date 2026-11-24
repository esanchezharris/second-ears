/**
 * Session spec — the core path with real signed-in sessions.
 *
 * Needs two test accounts (see tests/collab.spec.ts for how to create them).
 * `tests/fixtures/tone.wav` is a generated 6-second tone, small enough to
 * commit. The test deletes the track it creates, including the uploaded file.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { BrowserContext } from '@playwright/test'

const TONE_WAV = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/tone.wav')

const usableTestAccounts = loadAllTestAccounts().length
test.skip(usableTestAccounts < 2, `Needs 2 usable test accounts, found ${usableTestAccounts}.`)

/** Headers that make an API call as the user signed in to this browser context. */
async function authHeaders(context: BrowserContext) {
  const response = await context.request.post('/api/auth/token')
  const { token } = (await response.json()) as { token: string }
  return { Authorization: `Bearer ${token}` }
}

test('upload shows a waveform, comments sync live, and a stranger is locked out', async ({
  users,
}) => {
  const [owner, stranger] = await users(2)

  // Upload: the browser computes peaks, stores the file, and creates the track.
  await owner.page.goto('/tracks')
  await owner.page.getByTestId('upload-input').setInputFiles(TONE_WAV)
  await owner.page.waitForURL(/\/t\/[0-9a-f-]{36}$/)
  const trackId = owner.page.url().split('/t/')[1]

  try {
    await expect(owner.page.getByTestId('track-title')).toHaveText('tone')
    await expect(owner.page.getByTestId('waveform')).toBeVisible()
    // The play button enables only once the audio route has served the file.
    await expect(owner.page.getByTestId('play-button')).toBeEnabled({ timeout: 15_000 })

    // A second tab on the same track, to prove comments arrive without a refresh.
    const secondTab = await owner.context.newPage()
    await secondTab.goto(`/t/${trackId}`)
    await expect(secondTab.getByTestId('waveform')).toBeVisible()

    // Click the middle of the 6-second waveform, then comment there.
    const body = `__test-${Date.now()}__ kick is too loud here`
    await owner.page.getByTestId('waveform').click()
    await owner.page.getByTestId('comment-input').fill(body)
    await owner.page.getByTestId('comment-submit').click()

    const liveComment = secondTab.getByTestId('comment').filter({ hasText: body })
    await expect(liveComment).toBeVisible()
    await expect(liveComment).toContainText(/0:0[23]/)

    // A signed-in user who is not a member gets nothing: no page, audio, or write.
    await stranger.page.goto(`/t/${trackId}`)
    await expect(stranger.page.getByText('Track not found')).toBeVisible()

    const strangerHeaders = await authHeaders(stranger.context)
    const audio = await stranger.context.request.get(`/api/tracks/${trackId}/audio`, {
      headers: strangerHeaders,
    })
    expect(audio.status()).toBe(404)

    const forged = await stranger.context.request.post('/api/actions/addComment', {
      headers: strangerHeaders,
      data: { trackId, timeSec: 1, body: 'forged comment' },
    })
    expect(await forged.json()).toMatchObject({ success: false })
    await expect(secondTab.getByText('forged comment')).toHaveCount(0)

    const strangerDelete = await stranger.context.request.post('/api/actions/deleteTrack', {
      headers: strangerHeaders,
      data: { trackId },
    })
    expect(await strangerDelete.json()).toMatchObject({ success: false })
  } finally {
    const cleanup = await owner.context.request.post('/api/actions/deleteTrack', {
      headers: await authHeaders(owner.context),
      data: { trackId },
    })
    expect(await cleanup.json()).toMatchObject({ success: true })
  }
})
