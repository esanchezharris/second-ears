/**
 * PlayBar — the play/pause button, the time readout, and the audio element
 * itself, with the loading and error states for the audio download.
 */

import { Button } from '@/components/ui'
import type { Player } from '@/hooks/usePlayer'
import type { useTrackAudio } from '@/hooks/useTrackAudio'
import { formatTime } from '@/lib/format'

type Props = {
  audio: ReturnType<typeof useTrackAudio>
  player: Player
  durationSec: number
}

export function PlayBar({ audio, player, durationSec }: Props) {
  return (
    <div className="flex items-center gap-3">
      {/* The button enables only once the audio has downloaded. */}
      <Button onClick={player.togglePlay} disabled={!audio.url} data-testid="play-button">
        {player.isPlaying ? 'Pause' : 'Play'}
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatTime(player.currentTime)} / {formatTime(durationSec)}
      </span>
      {audio.status === 'loading' && (
        <span className="text-sm text-muted-foreground">Loading audio…</span>
      )}
      {audio.status === 'error' && (
        <span role="alert" className="flex items-center gap-2 text-sm text-destructive">
          {audio.error}
          <Button variant="outline" size="sm" onClick={audio.retry}>
            Retry
          </Button>
        </span>
      )}
      {player.error && (
        <span role="alert" className="text-sm text-destructive">
          {player.error}
        </span>
      )}
      {audio.url && <audio src={audio.url} {...player.audioProps} />}
    </div>
  )
}
