/**
 * /join/:token — where an invite link lands.
 *
 * This page sits under (protected), so a signed-out visitor is asked to sign
 * in first and then comes straight back here. Once signed in, it trades the
 * token for a reviewer membership (the `redeemInvite` action) and moves on to
 * the track.
 */

import { Link, Navigate, useParams } from 'react-router-dom'
import { useAsyncResource } from 'deepspace'
import { EmptyState } from '@/components/ui'
import { callAction } from '@/lib/actions'

export default function JoinPage() {
  const { token = '' } = useParams()
  // The action is safe to call twice: a second call finds the membership
  // already there and returns the same track.
  const join = useAsyncResource(
    () => callAction<{ trackId: string }>('redeemInvite', { token }),
    [token],
  )

  if (join.data) return <Navigate to={`/t/${join.data.trackId}`} replace />

  if (join.status === 'error') {
    return (
      <div className="px-6 py-10">
        {/* The message says what went wrong: a dead link, or no connection. */}
        <EmptyState
          title="Could not join this track"
          description={join.error ?? 'This invite link is not valid any more.'}
          action={{ label: 'Try again', onClick: join.reload }}
        />
        <p className="text-center text-sm">
          <Link to="/tracks" className="text-primary underline-offset-4 hover:underline">
            Go to your tracks
          </Link>
        </p>
      </div>
    )
  }

  return <p className="px-6 py-10 text-sm text-muted-foreground">Joining the track…</p>
}
