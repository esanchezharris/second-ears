/**
 * /home — where sign-in lands. Signed-in users go straight to their tracks;
 * signed-out visitors are pointed at the sign-in button in the navigation.
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from 'deepspace'

export default function HomePage() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) return <Navigate to="/tracks" replace />

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Second Ears</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Sign in to upload a track and collect timestamped feedback.
      </p>
    </div>
  )
}
