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

export type Priority = 'high' | 'medium' | 'low'

/** One line of the owner's revision list, written by the AI from comments. */
export type ChecklistItem = {
  trackId: string
  ownerId: string
  title: string
  priority: Priority
  /** Time of the earliest source comment. */
  timeSec: number
  /** Record ids of the comments this item was made from. */
  commentIds: string[]
  status: 'open' | 'done'
}

/** A paid AI run or email, logged before it is made. See paid-calls-schema.ts. */
export type PaidCall = {
  userId: string
  kind: 'revision-list' | 'first-comment-email'
  trackId: string
  slot: string
}

/** The columns of the platform's `users` collection that the server reads. */
export type User = {
  email: string
  name: string
}

/** Limits enforced by the server actions and mirrored in the UI. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024
export const MAX_TITLE_LENGTH = 120
export const MAX_COMMENT_LENGTH = 1000
export const MAX_PEAKS = 2000
export const MAX_CHECKLIST_TITLE_LENGTH = 200

/** What a public, listen-only link shows: no comments, no people, no file key. */
export type PublicTrack = {
  title: string
  durationSec: number
  peaks: number[]
}
