/**
 * Loads a track's audio from one of the worker routes in
 * src/server/track-routes.ts and exposes it as a local URL for <audio>.
 *
 * The whole file is downloaded up front (uploads are capped at 20 MB), which
 * keeps seeking instant and lets the request carry the user's token. A
 * signed-out listener on a public link has no token and sends none.
 */

import { useEffect, useState } from 'react'
import { getAuthToken, useAsyncResource } from 'deepspace'

export function useTrackAudio(audioUrl: string) {
  const download = useAsyncResource(
    async (signal) => {
      const token = await getAuthToken()
      const response = await fetch(audioUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not load the audio.')
      }
      return response.blob()
    },
    [audioUrl],
  )

  // Turn the downloaded bytes into a URL, and release it when no longer used.
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!download.data) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(download.data)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [download.data])

  return { url, status: download.status, error: download.error, retry: download.reload }
}
