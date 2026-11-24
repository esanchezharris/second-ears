/**
 * /t/:trackId — the session page for one track.
 *
 * This file only decides whether to show the session. It needs two rows, and
 * the server sends each only to people allowed to read it:
 *
 *   - the track itself
 *   - this user's membership of the track (owner or reviewer)
 *
 * If either is missing, the track does not exist or this user has no access;
 * the page says the same thing in both cases.
 *
 * Watching the membership row is what closes the session the moment an owner
 * removes a reviewer: the row's deletion arrives here live, whereas the track
 * row itself does not change.
 */

import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { EmptyState } from '@/components/ui'
import { TrackSession } from '@/components/TrackSession'
import type { TeamMember, Track } from '@/types'

export default function TrackPage() {
  const { trackId = '' } = useParams()
  const { userId } = useAuth()
  const tracks = useQuery<Track>('tracks', { where: { trackId } })
  const memberships = useQuery<TeamMember>('team_members', { where: { teamId: trackId, userId } })
  const track = tracks.records[0]
  const isMember = memberships.records.length > 0

  if (tracks.status === 'loading' || memberships.status === 'loading') {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading track…</p>
  }

  if (!track || !isMember) {
    return (
      <div className="px-6 py-10">
        <EmptyState
          title="Track not found"
          description="This track does not exist, or you have not been invited to it."
        />
        <p className="text-center text-sm">
          <Link to="/tracks" className="text-primary underline-offset-4 hover:underline">
            Back to your tracks
          </Link>
        </p>
      </div>
    )
  }

  return <TrackSession trackId={track.recordId} track={track.data} />
}
