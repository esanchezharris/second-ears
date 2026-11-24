/**
 * Waveform — draws the stored peaks, the playhead, and comment markers.
 *
 * Everything is positioned by fraction of the track (0..1), so the component
 * needs no resize logic: the SVG stretches to its container.
 */

import { useId, useMemo } from 'react'
import { formatTime } from '@/lib/format'

export type WaveformMarker = { id: string; timeSec: number; label: string }

type Props = {
  peaks: number[]
  durationSec: number
  currentTime: number
  markers: WaveformMarker[]
  /** Called with a time in seconds when the user clicks the waveform. */
  onSeek: (timeSec: number) => void
  onMarkerClick: (markerId: string) => void
}

const HEIGHT = 100

export function Waveform({ peaks, durationSec, currentTime, markers, onSeek, onMarkerClick }: Props) {
  const clipId = useId()
  const progress = durationSec > 0 ? Math.min(currentTime / durationSec, 1) : 0

  // One vertical line per peak, centred on the middle of the box.
  const path = useMemo(
    () =>
      peaks
        .map((peak, i) => {
          const barHeight = Math.max(peak * HEIGHT, 1)
          return `M${i + 0.5} ${(HEIGHT - barHeight) / 2}v${barHeight}`
        })
        .join(''),
    [peaks],
  )

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1)
    onSeek(fraction * durationSec)
  }

  return (
    <div
      data-testid="waveform"
      className="relative h-32 w-full cursor-pointer select-none rounded-lg border border-border bg-card"
      onClick={handleClick}
    >
      <svg
        viewBox={`0 0 ${peaks.length} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <clipPath id={clipId}>
          <rect x="0" y="0" width={progress * peaks.length} height={HEIGHT} />
        </clipPath>
        {/* Whole track, muted. */}
        <path d={path} className="stroke-muted-foreground/50" strokeWidth="0.6" />
        {/* The part already played, drawn on top in the accent colour. */}
        <path d={path} className="stroke-primary" strokeWidth="0.6" clipPath={`url(#${clipId})`} />
      </svg>

      {/* Playhead */}
      <div
        data-testid="playhead"
        className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
        style={{ left: `${progress * 100}%` }}
      />

      {/* Comment markers */}
      {markers.map((marker) => (
        <button
          key={marker.id}
          type="button"
          title={marker.label}
          aria-label={`Comment at ${formatTime(marker.timeSec)}: ${marker.label}`}
          className="absolute bottom-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background bg-primary hover:scale-125"
          style={{ left: `${(marker.timeSec / durationSec) * 100}%` }}
          onClick={(event) => {
            event.stopPropagation() // do not also treat this as a waveform click
            onMarkerClick(marker.id)
          }}
        />
      ))}
    </div>
  )
}
