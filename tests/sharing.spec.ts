/**
 * Sharing spec — roles, links and live playheads, with two real signed-in
 * users in separate browser contexts plus one signed-out browser.
 *
 * Needs two test accounts (see tests/collab.spec.ts for how to create them).
 * The test deletes the track it creates, including the uploaded file.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { BrowserContext, Page } from '@playwright/test'

const TONE_WAV = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/tone.wav')

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
  return (await response.json()) as { success: boolean }
}

/**
 * Try to open the track's presence room straight from this page, the way a
 * hand-written client would. Resolves true only if the server lets it in.
 */
function canJoinPresence(page: Page, trackId: string) {
  return page.evaluate(async (id) => {
    const tokenResponse = await fetch('/api/auth/token', { method: 'POST' })
    const { token } = (await tokenResponse.json().catch(() => ({}))) as { token?: string }
    const url = new URL(`/ws/presence/${encodeURIComponent(`track:${id}`)}`, location.href)
    url.protocol = url.protocol.replace('http', 'ws')
    if (token) url.searchParams.set('token', token)
    return new Promise<boolean>((resolve) => {
      const socket = new WebSocket(url)
      socket.onopen = () => {
        socket.close()
        resolve(true)
      }
      socket.onerror = () => resolve(false)
    })
  }, trackId)
}

test('invite makes a reviewer, playheads are live, public link is listen-only, removal locks out', async ({
  users,
  page: signedOutPage,
  request: signedOutRequest,
}) => {
  test.setTimeout(120_000)
  const [owner, reviewer] = await users(2)

  await owner.page.goto('/tracks')
  await owner.page.getByTestId('upload-input').setInputFiles(TONE_WAV)
  await owner.page.waitForURL(/\/t\/[0-9a-f-]{36}$/)
  const trackId = owner.page.url().split('/t/')[1]

  try {
    await test.step('before the invite, the second user has no access', async () => {
      await reviewer.page.goto(`/t/${trackId}`)
      await expect(reviewer.page.getByText('Track not found')).toBeVisible()
      expect(await canJoinPresence(reviewer.page, trackId)).toBe(false)
    })

    let invitePath = ''
    await test.step('the invite link turns the second user into a reviewer', async () => {
      await owner.page.getByTestId('share-button').click()
      await owner.page.getByTestId('create-invite').click()
      const inviteUrl = await owner.page.getByTestId('invite-link').inputValue()
      invitePath = new URL(inviteUrl).pathname
      expect(invitePath).toMatch(/^\/join\/[0-9a-f-]{36}$/)

      // Signed out, the link asks for sign-in and gives nothing away.
      await signedOutPage.goto(invitePath)
      await expect(signedOutPage.getByText('Sign in to continue')).toBeVisible()

      await reviewer.page.goto(invitePath)
      await reviewer.page.waitForURL(`**/t/${trackId}`)
      await expect(reviewer.page.getByTestId('waveform')).toBeVisible()
      await expect(reviewer.page.getByTestId('play-button')).toBeEnabled({ timeout: 15_000 })

      // The owner's open page shows the new reviewer without a refresh.
      await expect(owner.page.getByTestId('reviewer-list')).toContainText(reviewer.name)
    })

    await test.step('a reviewer gets no owner controls, in the page or on the server', async () => {
      await expect(reviewer.page.getByTestId('share-button')).toHaveCount(0)
      await expect(reviewer.page.getByRole('button', { name: 'Delete track' })).toHaveCount(0)

      const ownerOnly = [
        callAction(reviewer.context, 'createInviteLink', { trackId }),
        callAction(reviewer.context, 'removeReviewer', { trackId, reviewerId: owner.userId }),
        callAction(reviewer.context, 'deleteTrack', { trackId }),
      ]
      for (const result of await Promise.all(ownerOnly)) {
        expect(result).toMatchObject({ success: false })
      }
    })

    await test.step("a reviewer's comment reaches the owner live", async () => {
      const body = `__test-${Date.now()}__ vocal is buried here`
      await reviewer.page.getByTestId('comment-input').fill(body)
      await reviewer.page.getByTestId('comment-submit').click()
      await expect(owner.page.getByTestId('comment').filter({ hasText: body })).toBeVisible()
    })

    await test.step('each sees the other, and the other playhead moves', async () => {
      await expect(owner.page.getByTestId('listeners')).toContainText(reviewer.name)
      await expect(reviewer.page.getByTestId('listeners')).toContainText(owner.name)

      // The owner clicks the middle of the waveform; the reviewer's page
      // draws the owner's playhead there, labelled with the owner's name.
      await owner.page.getByTestId('waveform').click()
      const ownerPlayhead = reviewer.page.getByTestId('listener-playhead')
      await expect(ownerPlayhead).toContainText(owner.name)
      await expect(ownerPlayhead).toHaveAttribute('style', /left: (4[5-9]|5[0-5])/)
    })

    await test.step('the public link is off by default and listen-only when on', async () => {
      const publicUrl = `/api/public/tracks/${trackId}`
      expect((await signedOutRequest.get(publicUrl)).status()).toBe(404)
      expect((await signedOutRequest.get(`${publicUrl}/audio`)).status()).toBe(404)

      await owner.page.getByTestId('public-switch').click()
      await expect(owner.page.getByTestId('public-link')).toHaveValue(
        new RegExp(`/listen/${trackId}$`),
      )
      await expect.poll(async () => (await signedOutRequest.get(publicUrl)).status()).toBe(200)

      // The public answer carries the title and waveform, and nothing else.
      const publicTrack = await (await signedOutRequest.get(publicUrl)).json()
      expect(Object.keys(publicTrack).sort()).toEqual(['durationSec', 'peaks', 'title'])

      await signedOutPage.goto(`/listen/${trackId}`)
      await expect(signedOutPage.getByTestId('track-title')).toHaveText('tone')
      await expect(signedOutPage.getByTestId('play-button')).toBeEnabled({ timeout: 15_000 })
      await expect(signedOutPage.getByTestId('comment-input')).toHaveCount(0)
      await expect(signedOutPage.getByTestId('comment')).toHaveCount(0)
      expect(await canJoinPresence(signedOutPage, trackId)).toBe(false)

      await owner.page.getByTestId('public-switch').click()
      await expect.poll(async () => (await signedOutRequest.get(publicUrl)).status()).toBe(404)
    })

    await test.step('a removed reviewer is locked out', async () => {
      await owner.page.getByTestId('reviewer-list').getByRole('button', { name: 'Remove' }).click()
      await expect(owner.page.getByText('Nobody has joined yet.')).toBeVisible()

      const audio = await reviewer.context.request.get(`/api/tracks/${trackId}/audio`, {
        headers: await authHeaders(reviewer.context),
      })
      expect(audio.status()).toBe(404)
      expect(
        await callAction(reviewer.context, 'addComment', { trackId, timeSec: 1, body: 'still here?' }),
      ).toMatchObject({ success: false })

      // The reviewer's open page closes by itself, with no reload: the
      // deletion of their membership row reaches it live.
      await expect(reviewer.page.getByText('Track not found')).toBeVisible()
      await expect(owner.page.getByTestId('listeners')).not.toContainText(reviewer.name)
      expect(await canJoinPresence(reviewer.page, trackId)).toBe(false)
    })

    await test.step('replacing the invite link kills the old one', async () => {
      await owner.page.getByRole('button', { name: 'Replace with a new link' }).click()
      await expect(owner.page.getByTestId('invite-link')).not.toHaveValue(new RegExp(`${invitePath}$`))

      const oldToken = invitePath.split('/join/')[1]
      expect(await callAction(reviewer.context, 'redeemInvite', { token: oldToken })).toMatchObject({
        success: false,
      })
    })

    await test.step('control: a member can open the presence room', async () => {
      // Proves the `false` results above come from the server's gate, not
      // from a helper that can never connect.
      expect(await canJoinPresence(owner.page, trackId)).toBe(true)
    })
  } finally {
    expect(await callAction(owner.context, 'deleteTrack', { trackId })).toMatchObject({ success: true })
  }
})
