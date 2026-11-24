/**
 * /tracks — every track the signed-in user can see (their own and the ones
 * they review), plus the upload button.
 *
 * The list is a live query: the server only sends rows this user may read,
 * so there is no filtering to do here.
 */

import { Link } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Badge, EmptyState } from '@/components/ui'
import { UploadTrack } from '@/components/UploadTrack'
import { formatTime } from '@/lib/format'
import type { Track } from '@/types'

export default function TracksPage() {
  const { userId } = useAuth()
  const { records, status } = useQuery<Track>('tracks', { orderBy: 'createdAt', orderDir: 'desc' })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your tracks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a work in progress, then share it for timestamped feedback.
          </p>
        </div>
        <UploadTrack />
      </header>

      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading tracks…</p>}

      {status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          Could not load your tracks. Reload the page to try again.
        </p>
      )}

      {status === 'ready' && records.length === 0 && (
        <EmptyState
          title="No tracks yet"
          description="Upload an mp3 or wav to start collecting feedback."
        />
      )}

      {records.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="track-list">
          {records.map((record) => (
            <li key={record.recordId}>
              <Link
                to={`/t/${record.recordId}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
              >
                <span className="truncate font-medium text-foreground">{record.data.title}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="secondary">
                    {record.data.ownerId === userId ? 'Owner' : 'Reviewer'}
                  </Badge>
                  {formatTime(record.data.durationSec)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
