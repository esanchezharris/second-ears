/**
 * Track audio route.
 *
 * Audio files live in the owner's private file storage, which only the owner
 * can read directly. This route is how everyone else with access hears the
 * track: it checks the caller's membership, then streams the file.
 */

import type { Hono } from 'hono'
import { AppFileError, appFiles } from 'deepspace/worker'
import type { VerifyResult } from 'deepspace/worker'
import { getTrackRole } from '../actions/track-access.js'
import type { Track } from '../types.js'
import type { AppContext, Env } from '../../worker.js'
import { createActionTools } from './action-routes.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

export function registerTrackRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  app.get('/api/tracks/:trackId/audio', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in to listen to this track.' }, 401)

    const trackId = c.req.param('trackId')
    // No caller token is needed: this route calls no integrations.
    const tools = createActionTools(c.env, auth.userId, '')

    // Same answer for "no such track" and "not yours", so ids cannot be probed.
    const role = await getTrackRole(tools, trackId, auth.userId)
    if (!role) return c.json({ error: 'Track not found.' }, 404)

    const track = await tools.get<Track>('tracks', trackId)
    if (!track.success) return c.json({ error: 'Track not found.' }, 404)
    const { ownerId, audioKey } = track.data.record.data

    try {
      const file = await appFiles(c.env, { scope: 'self', userId: ownerId }).download(audioKey)
      return new Response(file.body, {
        headers: {
          'Content-Type': file.headers.get('Content-Type') ?? 'application/octet-stream',
          // The browser may keep its copy; shared caches must not.
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch (err) {
      if (err instanceof AppFileError && err.status === 404) {
        return c.json({ error: 'The audio file for this track is missing.' }, 404)
      }
      throw err
    }
  })
}
