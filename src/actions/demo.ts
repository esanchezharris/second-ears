/**
 * openDemo — give the caller their own copy of the demo session.
 *
 * A new visitor has no tracks and nobody to review with, so the app would
 * look empty. The demo is a real track that the caller owns: the bundled
 * audio, plus comments from three made-up reviewers. Everything works on it,
 * including sharing and the AI revision list.
 *
 * Each user has at most one demo. It is a row like any other track, but its
 * audio is the file shipped with the app, so it uses none of the caller's
 * (or the app's) file storage.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { DEMO_COMMENTS, DEMO_TRACK } from '../demo/seed'
import { DEMO_AUDIO_KEY, type Track } from '../types'
import { createOwnedTrack } from './owned-track'

export const openDemo: ActionHandler<Env> = async ({ userId, tools }) => {
  // Already has one: open it rather than making a second.
  const existing = await tools.query<Track>('tracks', {
    where: { ownerId: userId, audioKey: DEMO_AUDIO_KEY },
    limit: 1,
  })
  const current = existing.success ? existing.data.records[0] : undefined
  if (current) return { success: true, data: { trackId: current.recordId } }

  const created = await createOwnedTrack(tools, userId, DEMO_TRACK)
  if (!created.success) return created
  const { trackId } = created.data

  // Written directly, not through `addComment`: seeded comments must not
  // send the first-comment email.
  for (const comment of DEMO_COMMENTS) {
    await tools.create('comments', { ...comment, trackId })
  }

  return { success: true, data: { trackId } }
}
