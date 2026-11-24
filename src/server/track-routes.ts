/**
 * Track routes — audio for members, and the public listen-only view.
 *
 * Audio files live in the owner's private file storage, which only the owner
 * can read directly. These routes are how everyone else hears a track: each
 * one decides whether the caller may listen, then streams the file.
 *
 *   /api/tracks/:id/audio          signed-in members of the track
 *   /api/public/tracks/:id         anyone, only while the owner has made the track public
 *   /api/public/tracks/:id/audio   same rule
 */

import type { Hono } from 'hono'
import { AppFileError, appFiles } from 'deepspace/worker'
import type { ActionTools, VerifyResult } from 'deepspace/worker'
import { getTrackRole } from '../actions/track-access.js'
import { DEMO_AUDIO_KEY, type PublicTrack, type Track } from '../types.js'
import type { AppContext, Env } from '../../worker.js'
import { createActionTools } from './action-routes.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

// Same answer for "no such track" and "not yours", so ids cannot be probed.
const NOT_FOUND = { error: 'Track not found.' }
const AUDIO_MISSING = { error: 'The audio file for this track is missing.' }

/**
 * Stream a track's audio file out of its owner's private storage.
 * A demo track's audio is not in storage: it is a file shipped with the app.
 */
async function audioResponse(env: Env, track: Track, requestUrl: string): Promise<Response> {
  if (track.audioKey === DEMO_AUDIO_KEY) {
    const asset = await env.ASSETS.fetch(new URL(`/${DEMO_AUDIO_KEY}`, requestUrl))
    if (!asset.ok) return Response.json(AUDIO_MISSING, { status: 404 })
    // Name the type ourselves: in production the asset server labels the mp3
    // as a generic binary file, which some browsers refuse to play.
    return new Response(asset.body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' },
    })
  }
  try {
    const files = appFiles(env, { scope: 'self', userId: track.ownerId })
    const file = await files.download(track.audioKey)
    return new Response(file.body, {
      headers: {
        'Content-Type': file.headers.get('Content-Type') ?? 'application/octet-stream',
        // The browser may keep its copy; shared caches must not.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    if (err instanceof AppFileError && err.status === 404) {
      return Response.json(AUDIO_MISSING, { status: 404 })
    }
    throw err
  }
}

/** The track, but only while its owner has switched the public link on. */
async function getPublicTrack(tools: ActionTools, trackId: string): Promise<Track | null> {
  const result = await tools.get<Track>('tracks', trackId)
  if (!result.success) return null
  const track = result.data.record.data
  return track.visibility === 'public' ? track : null
}

export function registerTrackRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  app.get('/api/tracks/:trackId/audio', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in to listen to this track.' }, 401)

    const trackId = c.req.param('trackId')
    // No caller token is needed: this route calls no integrations.
    const tools = createActionTools(c.env, auth.userId, '')

    const role = await getTrackRole(tools, trackId, auth.userId)
    if (!role) return c.json(NOT_FOUND, 404)

    const track = await tools.get<Track>('tracks', trackId)
    if (!track.success) return c.json(NOT_FOUND, 404)

    return audioResponse(c.env, track.data.record.data, c.req.url)
  })

  // The public routes take no sign-in. They read as the app owner because a
  // signed-out caller has no user id, and they hand back only what a listener
  // needs: never comments, members, or the storage key.
  app.get('/api/public/tracks/:trackId', async (c) => {
    const tools = createActionTools(c.env, c.env.OWNER_USER_ID, '')
    const track = await getPublicTrack(tools, c.req.param('trackId'))
    if (!track) return c.json(NOT_FOUND, 404)

    const body: PublicTrack = {
      title: track.title,
      durationSec: track.durationSec,
      peaks: track.peaks,
    }
    return c.json(body)
  })

  app.get('/api/public/tracks/:trackId/audio', async (c) => {
    const tools = createActionTools(c.env, c.env.OWNER_USER_ID, '')
    const track = await getPublicTrack(tools, c.req.param('trackId'))
    if (!track) return c.json(NOT_FOUND, 404)

    return audioResponse(c.env, track, c.req.url)
  })
}
