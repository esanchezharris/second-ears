/**
 * States spec — what the user sees when things go wrong.
 *
 * Failures are forced by intercepting the browser's requests, so no server
 * is harmed and no paid call is made (the "Make revision list" request is
 * answered by the test, never by the app). The rule being checked: the user
 * always gets a plain sentence and a way forward, never a raw error.
 *
 * It uploads its own small track rather than using the demo, so it cannot
 * collide with tests/demo.spec.ts running at the same time on the same account.
 *
 * Needs one test account (see tests/collab.spec.ts for how to create them).
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { BrowserContext, Page } from '@playwright/test'

const usableTestAccounts = loadAllTestAccounts().length
test.skip(usableTestAccounts < 1, `Needs 1 usable test account, found ${usableTestAccounts}.`)

const TONE_WAV = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/tone.wav')
const SERVER_CRASH = { status: 500, contentType: 'text/plain', body: 'Internal Server Error' }

async function callAction(context: BrowserContext, name: string, data: Record<string, unknown>) {
  const tokenResponse = await context.request.post('/api/auth/token')
  const { token } = (await tokenResponse.json()) as { token: string }
  const response = await context.request.post(`/api/actions/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  return (await response.json()) as { success: boolean; data?: { trackId: string } }
}

/** Nothing that looks like a raw error may be on the page. */
async function expectNoRawError(page: Page) {
  await expect(page.getByText(/Internal Server Error|TypeError|Unexpected token|at \w+ \(/)).toHaveCount(0)
}

test('signed in: failures on the track page are explained and recoverable', async ({ users }) => {
  const [user] = await users(1)
  const { page } = user

  await page.goto('/tracks')
  await page.getByTestId('upload-input').setInputFiles(TONE_WAV)
  await page.waitForURL(/\/t\/[0-9a-f-]{36}$/)
  const trackId = page.url().split('/t/')[1]
  await callAction(user.context, 'addComment', { trackId, timeSec: 1, body: 'Hi-hats are harsh here' })

  try {
    await test.step('a track that does not exist', async () => {
      await page.goto('/t/00000000-0000-4000-8000-000000000000')
      await expect(page.getByText('Track not found')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to your tracks' })).toBeVisible()
    })

    await test.step('an invite link that does not exist', async () => {
      await page.goto('/join/not-a-real-token')
      await expect(page.getByText('Could not join this track')).toBeVisible()
      await expect(page.getByText('This invite link is not valid any more.')).toBeVisible()
    })

    await test.step('the audio fails to download, then Retry works', async () => {
      await page.route('**/api/tracks/*/audio', (route) => route.fulfill(SERVER_CRASH))
      await page.goto(`/t/${trackId}`)
      await expect(page.getByText('Could not load the audio.')).toBeVisible()
      await expect(page.getByTestId('play-button')).toBeDisabled()
      // The rest of the session still works without the audio.
      await expect(page.getByTestId('comment')).toHaveCount(1)
      await expectNoRawError(page)

      await page.unroute('**/api/tracks/*/audio')
      await page.getByRole('button', { name: 'Retry' }).click()
      await expect(page.getByTestId('play-button')).toBeEnabled({ timeout: 15_000 })
    })

    await test.step('adding a comment fails: the text is kept and the reason shown', async () => {
      await page.getByTestId('comment-input').fill('Snare is late here')

      await page.route('**/api/actions/addComment', (route) => route.fulfill(SERVER_CRASH))
      await page.getByTestId('comment-submit').click()
      await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible()

      await page.unroute('**/api/actions/addComment')
      await page.route('**/api/actions/addComment', (route) => route.abort())
      await page.getByTestId('comment-submit').click()
      await expect(page.getByText(/Could not reach the server/)).toBeVisible()

      await expect(page.getByTestId('comment-input')).toHaveValue('Snare is late here')
      await expect(page.getByTestId('comment')).toHaveCount(1)
      await expectNoRawError(page)
      await page.unroute('**/api/actions/addComment')
    })

    await test.step('the revision list fails: a message, and the button comes back', async () => {
      await page.route('**/api/actions/makeRevisionList', (route) => route.fulfill(SERVER_CRASH))
      await page.getByTestId('make-revision-list').click()
      await expect(page.getByText('Could not make the revision list')).toBeVisible()
      await expect(page.getByTestId('make-revision-list')).toBeEnabled()
      await expect(page.getByTestId('make-revision-list')).toHaveText('Make revision list')
      await expectNoRawError(page)
      await page.unroute('**/api/actions/makeRevisionList')
    })
  } finally {
    expect(await callAction(user.context, 'deleteTrack', { trackId })).toMatchObject({ success: true })
  }
})

test('signed out: the public link tells "not shared" apart from "could not load"', async ({ page }) => {
  const publicTrack = '**/api/public/tracks/*'

  await page.route(publicTrack, (route) => route.fulfill(SERVER_CRASH))
  await page.goto('/listen/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('Could not load this track')).toBeVisible()
  await expectNoRawError(page)

  // The server is back, and its real answer for this id is "not public".
  await page.unroute(publicTrack)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Nothing to listen to here')).toBeVisible()
})
