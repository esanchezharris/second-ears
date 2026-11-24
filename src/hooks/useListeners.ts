/**
 * Live playheads: tells everyone in a track's session where this user's
 * playhead is, and returns where everyone else's is.
 *
 * Built on the SDK's presence room, which is ephemeral: nothing is stored, and
 * a listener disappears for the others within a second of closing the page.
 * The server only lets members of the track into the room
 * (src/server/realtime-routes.ts).
 */

import { useEffect, useRef } from 'react'
import { getUserColor, usePresenceRoom } from 'deepspace'

/** Send our position at most this often: four times a second. */
const SEND_INTERVAL_MS = 250

export type Listener = {
  userId: string
  name: string
  color: string
  /** null until this listener's first position arrives. */
  timeSec: number | null
  isPlaying: boolean
}

export function useListeners(trackId: string, timeSec: number, isPlaying: boolean): Listener[] {
  const { peers, connected, updateState } = usePresenceRoom(`track:${trackId}`)

  // The newest position, kept outside the timer below so the timer does not
  // restart every time the playhead moves.
  const latest = useRef({ timeSec, isPlaying })
  useEffect(() => {
    latest.current = { timeSec, isPlaying }
  }, [timeSec, isPlaying])

  // The throttle: look every 250 ms and send only if something changed since
  // the last send. A paused, idle listener therefore sends nothing at all.
  // After a reconnect the room has forgotten us, so `lastSent` starts empty
  // again and the first tick re-sends our position.
  useEffect(() => {
    if (!connected) return
    let lastSent = ''
    const timer = setInterval(() => {
      const next = JSON.stringify(latest.current)
      if (next === lastSent) return
      lastSent = next
      updateState(latest.current)
    }, SEND_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [connected, updateState])

  // `peers` never includes this user. Names come from each peer's verified
  // sign-in, so one listener cannot pose as another.
  return peers.map((peer) => ({
    userId: peer.userId,
    name: peer.userName || 'Someone',
    color: getUserColor(peer.userId),
    timeSec: typeof peer.state.timeSec === 'number' ? peer.state.timeSec : null,
    isPlaying: peer.state.isPlaying === true,
  }))
}
