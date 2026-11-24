/**
 * Record shapes shared by the browser and the worker.
 * Each matches the columns of the schema with the same name in src/schemas/.
 */

export type Track = {
  trackId: string
  ownerId: string
  title: string
  audioKey: string
  durationSec: number
  peaks: number[]
  visibility: 'private' | 'public'
}

export type TrackRole = 'owner' | 'reviewer'

export type TeamMember = {
  teamId: string
  userId: string
  status: string
  role: TrackRole
}

/** An invite link. The record id is the secret part of the link. */
export type Invite = {
  trackId: string
  ownerId: string
}

export type Comment = {
  trackId: string
  authorId: string
  timeSec: number
  body: string
}

/** Limits enforced by the server actions and mirrored in the UI. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024
export const MAX_TITLE_LENGTH = 120
export const MAX_COMMENT_LENGTH = 1000
export const MAX_PEAKS = 2000

/** What a public, listen-only link shows: no comments, no people, no file key. */
export type PublicTrack = {
  title: string
  durationSec: number
  peaks: number[]
}
