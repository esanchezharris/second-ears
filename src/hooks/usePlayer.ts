/**
 * Playback state for one <audio> element: where the playhead is, whether it
 * is playing, and how to move it. Used by the session page and the public
 * listen page, together with <PlayBar>.
 */

import { useRef, useState, type SyntheticEvent } from 'react'

export function usePlayer() {
  const audioElement = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  function seek(timeSec: number) {
    setCurrentTime(timeSec)
    if (audioElement.current) audioElement.current.currentTime = timeSec
  }

  function togglePlay() {
    const element = audioElement.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }

  /** Spread onto the <audio> element so this hook hears what it does. */
  const audioProps = {
    ref: audioElement,
    onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) =>
      setCurrentTime(event.currentTarget.currentTime),
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
  }

  return { currentTime, isPlaying, seek, togglePlay, audioProps }
}

export type Player = ReturnType<typeof usePlayer>
