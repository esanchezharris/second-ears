import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  test('server actions refuse signed-out callers', async ({ request }) => {
    const actions = [
      'createTrack',
      'addComment',
      'deleteTrack',
      'createInviteLink',
      'redeemInvite',
      'removeReviewer',
    ]
    for (const action of actions) {
      const res = await request.post(`/api/actions/${action}`, { data: {} })
      expect(res.status(), action).toBe(401)
    }
  })

  test('track audio refuses signed-out callers', async ({ request }) => {
    const res = await request.get('/api/tracks/any-track-id/audio')
    expect(res.status()).toBe(401)
  })

  test('public track routes answer 404 for a track that is not public', async ({ request }) => {
    expect((await request.get('/api/public/tracks/any-track-id')).status()).toBe(404)
    expect((await request.get('/api/public/tracks/any-track-id/audio')).status()).toBe(404)
  })
})
