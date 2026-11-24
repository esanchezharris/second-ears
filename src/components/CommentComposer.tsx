/**
 * CommentComposer — write a comment for a moment on the track.
 *
 * Comments are created through the `addComment` server action, because only
 * the server can check that the author is a member of this track. The new
 * comment then arrives through the live query like everyone else's.
 */

import { useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatTime } from '@/lib/format'
import { MAX_COMMENT_LENGTH } from '@/types'

type Props = {
  trackId: string
  /** The moment the comment will be pinned to. */
  timeSec: number
  /** Called on the first keystroke, so the parent can freeze `timeSec`. */
  onStartTyping: () => void
  onAdded: () => void
}

export function CommentComposer({ trackId, timeSec, onStartTyping, onAdded }: Props) {
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSending(true)
    try {
      await callAction('addComment', { trackId, timeSec, body })
      setBody('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the comment.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="comment-body" className="text-sm font-medium text-foreground">
        Comment at <span className="tabular-nums">{formatTime(timeSec)}</span>
      </label>
      <Textarea
        id="comment-body"
        data-testid="comment-input"
        value={body}
        maxLength={MAX_COMMENT_LENGTH}
        placeholder="Click the waveform to pick a moment, then say what you hear."
        onChange={(event) => {
          if (!body) onStartTyping()
          setBody(event.target.value)
        }}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSending || !body.trim()} data-testid="comment-submit">
          {isSending ? 'Adding…' : 'Add comment'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
