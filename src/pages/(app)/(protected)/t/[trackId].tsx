/**
 * /t/:trackId — the session page for one track.
 *
 * This file only finds the track. If the query comes back empty, the track
 * either does not exist or the server decided this user may not read it; the
 * page says the same thing in both cases.
 */

import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { EmptyState } from '@/components/ui'
import { TrackSession } from '@/components/TrackSession'
import type { Track } from '@/types'

export default function TrackPage() {
  const { trackId = '' } = useParams()
  const { records, status } = useQuery<Track>('tracks', { where: { trackId } })
  const track = records[0]

  if (status === 'loading') {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading track…</p>
  }

  if (!track) {
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
