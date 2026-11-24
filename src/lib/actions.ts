/**
 * Call a server action (src/actions/index.ts) as the signed-in user.
 * Resolves with the action's data, or throws an Error whose message is safe
 * to show to the user.
 */

import { getAuthToken } from 'deepspace'

export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in to continue.')

  let response: Response
  try {
    response = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  const result = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: string }
    | null
  if (!response.ok || !result?.success) {
    throw new Error(result?.error ?? 'Something went wrong. Please try again.')
  }
  return result.data as T
}
