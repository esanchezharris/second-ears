/**
 * The spending guard for everything the app owner is billed for.
 *
 * AI runs and emails are paid by the app owner, whoever triggers them. Every
 * paid call must first claim a row in `paid_calls`; if the claim is refused,
 * the call is not made.
 */

import type { ActionTools } from 'deepspace/worker'
import type { PaidCall } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export type ClaimResult =
  | 'claimed'
  /** Another call already holds this slot (see paid-calls-schema.ts). */
  | 'slot-taken'
  /** This user has made `dailyLimit` calls of this kind in the last 24 hours. */
  | 'daily-limit'
  /** The log could not be read. Refuse rather than spend unchecked. */
  | 'unavailable'

export async function claimPaidCall(
  tools: ActionTools,
  call: PaidCall,
  dailyLimit: number,
): Promise<ClaimResult> {
  // The user's newest `dailyLimit` calls of this kind. If that many exist and
  // even the oldest of them is under a day old, the limit is used up.
  const recent = await tools.query<PaidCall>('paid_calls', {
    where: { userId: call.userId, kind: call.kind },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: dailyLimit,
  })
  if (!recent.success) return 'unavailable'
  const oldest = recent.data.records[dailyLimit - 1]
  if (oldest && Date.now() - new Date(oldest.createdAt).getTime() < DAY_MS) return 'daily-limit'

  // `slot` is unique, so this create fails if the slot is already taken.
  const claimed = await tools.create('paid_calls', call)
  return claimed.success ? 'claimed' : 'slot-taken'
}
