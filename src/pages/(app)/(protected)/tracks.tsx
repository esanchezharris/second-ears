/**
 * /tracks — every track the signed-in user can see (their own and the ones
 * they review), plus the upload button.
 *
 * The list is a live query: the server only sends rows this user may read,
 * so there is no filtering to do here.
 *
 * Until the user has a demo track, the page also offers to open one (the
 * `openDemo` server action), so a first visit is never just an empty list.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Badge, Button, EmptyState, useToast } from '@/components/ui'
import { UploadTrack } from '@/components/UploadTrack'
import { callAction } from '@/lib/actions'
import { formatTime } from '@/lib/format'
import { DEMO_AUDIO_KEY, type Track } from '@/types'

export default function TracksPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { userId } = useAuth()
  const { records, status } = useQuery<Track>('tracks', { orderBy: 'createdAt', orderDir: 'desc' })
  const [isOpeningDemo, setIsOpeningDemo] = useState(false)

  const isDemo = (track: Track) => track.audioKey === DEMO_AUDIO_KEY
  const hasDemo = records.some((record) => isDemo(record.data) && record.data.ownerId === userId)

  async function openDemo() {
    setIsOpeningDemo(true)
    try {
      const { trackId } = await callAction<{ trackId: string }>('openDemo', {})
      navigate(`/t/${trackId}`)
    } catch (err) {
      toast.error('Could not open the demo', err instanceof Error ? err.message : undefined)
      setIsOpeningDemo(false)
    }
  }

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

      {status === 'ready' && !hasDemo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
          <p className="max-w-md text-sm text-muted-foreground">
            New here? The demo session is a track with reviewer comments already on it, so you can
            try everything without uploading.
          </p>
          <Button variant="outline" disabled={isOpeningDemo} data-testid="open-demo" onClick={openDemo}>
            {isOpeningDemo ? 'Opening…' : 'Open the demo session'}
          </Button>
        </div>
      )}

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
                  {isDemo(record.data) && <Badge variant="outline">Demo</Badge>}
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
