/**
 * The one email this app sends: the owner hears that feedback has started.
 *
 * It goes out when a reviewer leaves the first comment on a track, and never
 * again for that track. "Never again" is the `email:<trackId>` slot in
 * `paid_calls`: only the request that claims it sends the email.
 */

import type { ActionTools } from 'deepspace/worker'
import { formatTime } from '../lib/format'
import type { Track, User } from '../types'
import { claimPaidCall } from './paid-calls'

/** Stops one account from running up the bill by making tracks to comment on. */
const MAX_EMAILS_PER_DAY = 10

type NewComment = { authorId: string; timeSec: number; body: string }

export async function notifyOwnerOfFirstComment(
  tools: ActionTools,
  appUrl: string,
  trackId: string,
  track: Track,
  comment: NewComment,
): Promise<void> {
  // The owner's own comments are not news to the owner.
  if (comment.authorId === track.ownerId) return

  const claim = await claimPaidCall(
    tools,
    { userId: track.ownerId, kind: 'first-comment-email', trackId, slot: `email:${trackId}` },
    MAX_EMAILS_PER_DAY,
  )
  if (claim !== 'claimed') return

  const [owner, author] = await Promise.all([
    tools.get<User>('users', track.ownerId),
    tools.get<User>('users', comment.authorId),
  ])
  const to = owner.success ? owner.data.record.data.email : ''
  // DeepSpace test accounts use the reserved `.test` domain, which has no
  // inboxes. Sending there would be a paid call that can only bounce.
  if (!to || to.endsWith('.test')) return

  const authorName = (author.success && author.data.record.data.name) || 'A reviewer'
  const sent = await tools.integration('email/send', {
    to,
    subject: `First feedback on "${track.title}"`,
    text: [
      `${authorName} left the first comment on "${track.title}", at ${formatTime(comment.timeSec)}:`,
      '',
      comment.body,
      '',
      `Open the track: ${appUrl}/t/${trackId}`,
      '',
      'Second Ears sends this once per track. Later comments will not email you.',
    ].join('\n'),
  })
  // The slot stays claimed either way: at most one attempt per track.
  if (!sent.success) console.error(`[email] first-comment email failed: ${sent.error}`)
}
