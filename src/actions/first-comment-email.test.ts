/**
 * Unit tests for the first-comment email and the spending guard behind it.
 *
 * `tools` is replaced by a small in-memory fake, so these tests send no
 * email and cost nothing. The fake copies the two database behaviours the
 * code relies on: `slot` is unique, and queries can return the newest rows.
 */

import { describe, expect, test } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import type { PaidCall, Track, User } from '../types'
import { notifyOwnerOfFirstComment } from './first-comment-email'
import { claimPaidCall } from './paid-calls'

const HOUR_MS = 60 * 60 * 1000

function fakeTools(users: Record<string, User>) {
  const paidCalls: { recordId: string; data: PaidCall; createdAt: string }[] = []
  const emails: { endpoint: string; body: { to: string; subject: string; text: string } }[] = []

  const tools = {
    async query(_collection: string, options: { where: Partial<PaidCall>; limit: number }) {
      const records = paidCalls
        .filter((row) => row.data.userId === options.where.userId && row.data.kind === options.where.kind)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options.limit)
      return { success: true, data: { records } }
    },
    async create(_collection: string, data: PaidCall) {
      if (paidCalls.some((row) => row.data.slot === data.slot)) {
        return { success: false, error: 'Duplicate' }
      }
      const recordId = `call-${paidCalls.length + 1}`
      paidCalls.push({ recordId, data, createdAt: new Date().toISOString() })
      return { success: true, data: { recordId } }
    },
    async get(_collection: string, userId: string) {
      const user = users[userId]
      if (!user) return { success: false, error: 'Not found' }
      return { success: true, data: { record: { recordId: userId, data: user } } }
    },
    async integration(endpoint: string, body: { to: string; subject: string; text: string }) {
      emails.push({ endpoint, body })
      return { success: true, data: {} }
    },
  } as unknown as ActionTools

  return { tools, paidCalls, emails }
}

const track: Track = {
  trackId: 'track-1',
  ownerId: 'owner',
  title: 'Night Drive',
  audioKey: 'key',
  durationSec: 180,
  peaks: [0.5],
  visibility: 'private',
}

const users: Record<string, User> = {
  owner: { email: 'owner@example.com', name: 'Olive Owner' },
  reviewer: { email: 'reviewer@example.com', name: 'Rex Reviewer' },
}

const APP_URL = 'https://second-ears.app.space'

function notify(tools: ActionTools, authorId: string, body = 'The vocal is buried here.') {
  return notifyOwnerOfFirstComment(tools, APP_URL, 'track-1', track, { authorId, timeSec: 83, body })
}

describe('notifyOwnerOfFirstComment', () => {
  test("a reviewer's first comment emails the owner", async () => {
    const { tools, emails } = fakeTools(users)
    await notify(tools, 'reviewer')

    expect(emails).toHaveLength(1)
    expect(emails[0].endpoint).toBe('email/send')
    expect(emails[0].body.to).toBe('owner@example.com')
    expect(emails[0].body.subject).toContain('Night Drive')
    expect(emails[0].body.text).toContain('Rex Reviewer')
    expect(emails[0].body.text).toContain('1:23')
    expect(emails[0].body.text).toContain('The vocal is buried here.')
    expect(emails[0].body.text).toContain('https://second-ears.app.space/t/track-1')
  })

  test('later comments on the same track send nothing', async () => {
    const { tools, emails } = fakeTools(users)
    await notify(tools, 'reviewer')
    await notify(tools, 'reviewer', 'Second thought.')
    await notify(tools, 'someone-else', 'Me too.')

    expect(emails).toHaveLength(1)
  })

  test('two first comments at the same moment still send one email', async () => {
    const { tools, emails } = fakeTools(users)
    await Promise.all([notify(tools, 'reviewer'), notify(tools, 'someone-else')])

    expect(emails).toHaveLength(1)
  })

  test("the owner's own comment sends nothing and leaves the email for a reviewer", async () => {
    const { tools, emails, paidCalls } = fakeTools(users)
    await notify(tools, 'owner')
    expect(emails).toHaveLength(0)
    expect(paidCalls).toHaveLength(0)

    await notify(tools, 'reviewer')
    expect(emails).toHaveLength(1)
  })

  test('an owner on the reserved .test domain is never emailed', async () => {
    const { tools, emails } = fakeTools({
      ...users,
      owner: { email: 'se-owner@deepspace.test', name: 'Test Owner' },
    })
    await notify(tools, 'reviewer')

    expect(emails).toHaveLength(0)
  })
})

describe('claimPaidCall', () => {
  const call = (slot: string): PaidCall => ({
    userId: 'owner',
    kind: 'revision-list',
    trackId: 'track-1',
    slot,
  })

  test('a slot can be claimed once', async () => {
    const { tools } = fakeTools(users)

    expect(await claimPaidCall(tools, call('a'), 20)).toBe('claimed')
    expect(await claimPaidCall(tools, call('a'), 20)).toBe('slot-taken')
    expect(await claimPaidCall(tools, call('b'), 20)).toBe('claimed')
  })

  test('the daily limit counts calls from the last 24 hours only', async () => {
    const { tools, paidCalls } = fakeTools(users)

    expect(await claimPaidCall(tools, call('a'), 2)).toBe('claimed')
    expect(await claimPaidCall(tools, call('b'), 2)).toBe('claimed')
    expect(await claimPaidCall(tools, call('c'), 2)).toBe('daily-limit')

    // Move the first call to 25 hours ago: one call is left inside the day.
    paidCalls[0].createdAt = new Date(Date.now() - 25 * HOUR_MS).toISOString()
    expect(await claimPaidCall(tools, call('c'), 2)).toBe('claimed')
  })

  test('another user and another kind of call have their own limits', async () => {
    const { tools } = fakeTools(users)

    expect(await claimPaidCall(tools, call('a'), 1)).toBe('claimed')
    expect(await claimPaidCall(tools, { ...call('b'), userId: 'someone-else' }, 1)).toBe('claimed')
    expect(await claimPaidCall(tools, { ...call('c'), kind: 'first-comment-email' }, 1)).toBe('claimed')
    expect(await claimPaidCall(tools, call('d'), 1)).toBe('daily-limit')
  })
})
