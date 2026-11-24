/**
 * Server actions — called from the browser as POST /api/actions/<name>.
 *
 * The route (src/server/action-routes.ts) has already verified who is calling
 * and passes that as `userId`. The `tools` here bypass record permissions, so
 * every action checks access itself before writing.
 */

import { appFiles } from 'deepspace/worker'
import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  MAX_COMMENT_LENGTH,
  MAX_PEAKS,
  MAX_TITLE_LENGTH,
  type Invite,
  type TeamMember,
  type Track,
} from '../types'
import { getTrackRole } from './track-access'

function fail(error: string): ActionResult<never> {
  return { success: false, error }
}

/**
 * Create a track from an audio file the caller has already uploaded to their
 * own private file storage, and make the caller its owner.
 */
const createTrack: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const title = typeof params.title === 'string' ? params.title.trim() : ''
  const audioKey = typeof params.audioKey === 'string' ? params.audioKey : ''
  const durationSec = Number(params.durationSec)
  const peaks = params.peaks

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return fail(`Give the track a title of up to ${MAX_TITLE_LENGTH} characters.`)
  }
  // The key must sit in the caller's own folder. Without this check a caller
  // could name someone else's file and have the audio route serve it to them.
  if (!audioKey.includes(`/users/${userId}/`)) {
    return fail('That audio file does not belong to you.')
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return fail('The audio file has no playable length.')
  }
  const peaksAreValid =
    Array.isArray(peaks) &&
    peaks.length > 0 &&
    peaks.length <= MAX_PEAKS &&
    peaks.every((p) => typeof p === 'number' && p >= 0 && p <= 1)
  if (!peaksAreValid) return fail('The waveform data is not valid.')

  const trackId = crypto.randomUUID()
  const track = await tools.create(
    'tracks',
    { trackId, ownerId: userId, title, audioKey, durationSec, peaks, visibility: 'private' },
    trackId,
  )
  if (!track.success) return track

  const membership = await tools.create('team_members', {
    teamId: trackId,
    userId,
    status: 'active',
    role: 'owner',
  })
  if (!membership.success) return membership

  return { success: true, data: { trackId } }
}

/** Add a comment at a moment on a track. Owner and reviewers only. */
const addComment: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const trackId = typeof params.trackId === 'string' ? params.trackId : ''
  const body = typeof params.body === 'string' ? params.body.trim() : ''
  const timeSec = Number(params.timeSec)

  const role = await getTrackRole(tools, trackId, userId)
  if (!role) return fail('You do not have access to this track.')

  if (!body || body.length > MAX_COMMENT_LENGTH) {
    return fail(`Write a comment of up to ${MAX_COMMENT_LENGTH} characters.`)
  }
  if (!Number.isFinite(timeSec) || timeSec < 0) {
    return fail('The comment needs a valid time on the track.')
  }

  const comment = await tools.create('comments', { trackId, authorId: userId, timeSec, body })
  if (!comment.success) return comment

  return { success: true, data: { commentId: comment.data.recordId } }
}

/** Delete every record matching `where`. `deleteWhere` removes one page per call. */
async function deleteAll(tools: ActionTools, collection: string, where: Record<string, unknown>) {
  const pageSize = 500
  for (;;) {
    const page = await tools.deleteWhere(collection, where, pageSize)
    if (!page.success || page.data.deleted < pageSize) return
  }
}

/**
 * Make a fresh invite link for a track. Owner only. Any earlier link for the
 * track stops working, so "reset the link" is this same call.
 */
const createInviteLink: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const trackId = typeof params.trackId === 'string' ? params.trackId : ''

  const role = await getTrackRole(tools, trackId, userId)
  if (role !== 'owner') return fail('Only the owner can share this track.')

  await deleteAll(tools, 'invites', { trackId })
  // The record id is the secret in the link, so it must be unguessable.
  const token = crypto.randomUUID()
  const invite = await tools.create('invites', { trackId, ownerId: userId }, token)
  if (!invite.success) return invite

  return { success: true, data: { token } }
}

/** Use an invite link: the caller becomes a reviewer of the link's track. */
const redeemInvite: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const token = typeof params.token === 'string' ? params.token : ''

  const invite = token ? await tools.get<Invite>('invites', token) : null
  if (!invite?.success) return fail('This invite link is not valid any more.')
  const { trackId } = invite.data.record.data

  // Already on the track: the owner, or a reviewer opening the link again.
  if (await getTrackRole(tools, trackId, userId)) return { success: true, data: { trackId } }

  const membership = await tools.create('team_members', {
    teamId: trackId,
    userId,
    status: 'active',
    role: 'reviewer',
  })
  // Two requests can race to here. The schema allows one membership per user
  // per track, so the slower create fails although the user is now a member.
  if (!membership.success && !(await getTrackRole(tools, trackId, userId))) return membership

  return { success: true, data: { trackId } }
}

/** Take a reviewer off a track. Owner only; the owner cannot be removed. */
const removeReviewer: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const trackId = typeof params.trackId === 'string' ? params.trackId : ''
  const reviewerId = typeof params.reviewerId === 'string' ? params.reviewerId : ''

  const role = await getTrackRole(tools, trackId, userId)
  if (role !== 'owner') return fail('Only the owner can remove reviewers.')

  const found = await tools.query<TeamMember>('team_members', {
    where: { teamId: trackId, userId: reviewerId, role: 'reviewer' },
    limit: 1,
  })
  const membership = found.success ? found.data.records[0] : undefined
  if (!membership) return fail('That person is not a reviewer of this track.')

  const removed = await tools.remove('team_members', membership.recordId)
  if (!removed.success) return removed

  return { success: true, data: { reviewerId } }
}

/** Delete a track with its audio file, comments and memberships. Owner only. */
const deleteTrack: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const trackId = typeof params.trackId === 'string' ? params.trackId : ''

  const role = await getTrackRole(tools, trackId, userId)
  if (role !== 'owner') return fail('Only the owner can delete this track.')

  const track = await tools.get<Track>('tracks', trackId)
  if (!track.success) return track

  // The file first: storage is the scarce resource, so never strand it.
  await appFiles(env, { scope: 'self', userId }).delete(track.data.record.data.audioKey)
  await deleteAll(tools, 'comments', { trackId })
  await deleteAll(tools, 'invites', { trackId })
  await deleteAll(tools, 'team_members', { teamId: trackId })
  const removed = await tools.remove('tracks', trackId)
  if (!removed.success) return removed

  return { success: true, data: { trackId } }
}

export const actions: Record<string, ActionHandler<Env>> = {
  createTrack,
  addComment,
  deleteTrack,
  createInviteLink,
  redeemInvite,
  removeReviewer,
}
