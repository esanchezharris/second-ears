/**
 * The one place that answers "what may this user do on this track?".
 *
 * Server actions and worker routes run with record permissions switched off,
 * so each of them must call this before touching a track.
 */

import type { ActionTools } from 'deepspace/worker'
import type { TeamMember, TrackRole } from '../types'

/** The caller's role on a track, or null when they have no access to it. */
export async function getTrackRole(
  tools: ActionTools,
  trackId: string,
  userId: string,
): Promise<TrackRole | null> {
  const result = await tools.query<TeamMember>('team_members', {
    where: { teamId: trackId, userId },
    limit: 1,
  })
  if (!result.success) return null
  const membership = result.data.records[0]
  if (!membership || membership.data.status !== 'active') return null
  return membership.data.role
}
