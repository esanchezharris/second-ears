/**
 * CommentList — the comments on a track, in track order.
 *
 * Authors can edit and delete their own comments straight through
 * `useMutations`: the schema's `update: 'own'` / `delete: 'own'` rules are
 * enforced by the server, so the buttons here are a convenience, not the gate.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth, useMutations, useUserLookup, type RecordData } from 'deepspace'
import { Button, ConfirmModal, EmptyState, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/format'
import { MAX_COMMENT_LENGTH, type Comment } from '@/types'

type Props = {
  comments: RecordData<Comment>[]
  status: 'loading' | 'ready' | 'error'
  selectedCommentId: string | null
  onSeek: (timeSec: number) => void
}

export function CommentList({ comments, status, selectedCommentId, onSeek }: Props) {
  if (status === 'loading') {
    return <p className="text-sm text-muted-foreground">Loading comments…</p>
  }
  if (status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load comments. Reload the page to try again.
      </p>
    )
  }
  if (comments.length === 0) {
    return (
      <EmptyState
        title="No comments yet"
        description="Click the waveform at the moment you want to talk about."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="comment-list">
      {comments.map((comment) => (
        <CommentRow
          key={comment.recordId}
          comment={comment}
          isSelected={comment.recordId === selectedCommentId}
          onSeek={onSeek}
        />
      ))}
    </ul>
  )
}

function CommentRow({
  comment,
  isSelected,
  onSeek,
}: {
  comment: RecordData<Comment>
  isSelected: boolean
  onSeek: (timeSec: number) => void
}) {
  const { userId } = useAuth()
  const { getName } = useUserLookup()
  const { put, remove, ready } = useMutations<Comment>('comments')
  const [draft, setDraft] = useState<string | null>(null) // null = not editing
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const row = useRef<HTMLLIElement>(null)

  const isMine = comment.data.authorId === userId

  // Bring the comment into view when its marker on the waveform is clicked.
  useEffect(() => {
    if (isSelected) row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isSelected])

  return (
    <li
      ref={row}
      data-testid="comment"
      className={cn(
        'rounded-lg border bg-card px-4 py-3',
        isSelected ? 'border-primary' : 'border-border',
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          className="font-medium tabular-nums text-primary underline-offset-4 hover:underline"
          onClick={() => onSeek(comment.data.timeSec)}
        >
          {formatTime(comment.data.timeSec)}
        </button>
        <span className="text-muted-foreground">
          {getName(comment.data.authorId) ?? 'Someone'}
        </span>
        {isMine && draft === null && (
          <span className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" disabled={!ready} onClick={() => setDraft(comment.data.body)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" disabled={!ready} onClick={() => setIsConfirmingDelete(true)}>
              Delete
            </Button>
          </span>
        )}
      </div>

      {draft === null ? (
        <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.data.body}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            aria-label="Edit comment"
            value={draft}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!ready || !draft.trim()}
              onClick={() => {
                void put(comment.recordId, { body: draft.trim() })
                setDraft(null)
              }}
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={isConfirmingDelete}
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          void remove(comment.recordId)
          setIsConfirmingDelete(false)
        }}
        title="Delete this comment?"
        description="This cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </li>
  )
}
