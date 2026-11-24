/**
 * Create a track record together with its owner's membership row.
 * Shared by `createTrack` (an upload) and `openDemo` (the demo session).
 */

import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Track } from '../types'

type NewTrack = Pick<Track, 'title' | 'audioKey' | 'durationSec' | 'peaks'>

export async function createOwnedTrack(
  tools: ActionTools,
  ownerId: string,
  fields: NewTrack,
): Promise<ActionResult<{ trackId: string }>> {
  const trackId = crypto.randomUUID()
  const track = await tools.create(
    'tracks',
    { ...fields, trackId, ownerId, visibility: 'private' },
    trackId,
  )
  if (!track.success) return track

  const membership = await tools.create('team_members', {
    teamId: trackId,
    userId: ownerId,
    status: 'active',
    role: 'owner',
  })
  if (!membership.success) return membership

  return { success: true, data: { trackId } }
}
