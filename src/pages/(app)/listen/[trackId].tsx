/**
 * /listen/:trackId — the public, listen-only view of a track.
 *
 * No sign-in is needed, so this page lives outside (protected). It never
 * touches the records connection: everything it shows comes from the two
 * /api/public/tracks routes, which answer only while the owner has the public
 * link switched on, and which return the title, waveform and audio only.
 * There are no comments or other listeners here, by design.
 */

import { useParams } from 'react-router-dom'
import { useAsyncResource } from 'deepspace'
import { EmptyState } from '@/components/ui'
import { PlayBar } from '@/components/PlayBar'
import { Waveform } from '@/components/Waveform'
import { usePlayer } from '@/hooks/usePlayer'
import { useTrackAudio } from '@/hooks/useTrackAudio'
import type { PublicTrack } from '@/types'

export default function ListenPage() {
  const { trackId = '' } = useParams()

  // Resolves to null when the server says this track is not public (404).
  // Any other failure throws, and gets a retry button instead.
  const track = useAsyncResource(
    async (signal) => {
      const response = await fetch(`/api/public/tracks/${trackId}`, { signal })
      if (response.status === 404) return null
      if (!response.ok) throw new Error('The server could not load this track.')
      return (await response.json()) as PublicTrack
    },
    [trackId],
  )

  if (track.status === 'error') {
    return (
      <EmptyState
        title="Could not load this track"
        description="Something went wrong on the way. Check your connection and try again."
        action={{ label: 'Try again', onClick: track.reload }}
      />
    )
  }
  if (track.status !== 'ready') {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading track…</p>
  }
  if (!track.data) {
    return (
      <EmptyState
        title="Nothing to listen to here"
        description="This link is not active. The owner may have switched off public listening."
      />
    )
  }
  return <Player trackId={trackId} track={track.data} />
}

function Player({ trackId, track }: { trackId: string; track: PublicTrack }) {
  const audio = useTrackAudio(`/api/public/tracks/${trackId}/audio`)
  const player = usePlayer()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="track-title">
          {track.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Shared for listening only.</p>
      </header>

      <PlayBar audio={audio} player={player} durationSec={track.durationSec} />

      <Waveform
        peaks={track.peaks}
        durationSec={track.durationSec}
        currentTime={player.currentTime}
        markers={[]}
        listeners={[]}
        onSeek={player.seek}
        onMarkerClick={() => {}}
      />
    </div>
  )
}
