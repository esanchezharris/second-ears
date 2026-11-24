/**
 * RevisionList — the owner's checklist, written by the AI from the comments.
 *
 * "Make revision list" calls the `makeRevisionList` server action, which
 * checks ownership and the rate limit before it runs the model. The items it
 * writes arrive here through a live query, like comments do.
 *
 * Ticking, rewording and deleting go straight through `useMutations`. The
 * schema lets only the owner do that, and only to `status` and `title`.
 *
 * Only the owner is shown this panel, and only the owner can read the rows.
 */

import { useState } from 'react'
import { useMutations, useQuery, type RecordData } from 'deepspace'
import { Badge, Button, Checkbox, ConfirmModal, Input, useToast } from '@/components/ui'
import type { BadgeProps } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  MAX_CHECKLIST_TITLE_LENGTH,
  type ChecklistItem,
  type Comment,
  type Priority,
} from '@/types'

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_BADGE: Record<Priority, BadgeProps['variant']> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
}

type Props = {
  trackId: string
  comments: RecordData<Comment>[]
  onSelectComment: (commentId: string) => void
}

export function RevisionList({ trackId, comments, onSelectComment }: Props) {
  const toast = useToast()
  const [isMaking, setIsMaking] = useState(false)

  const itemsQuery = useQuery<ChecklistItem>('checklist_items', { where: { trackId } })
  // Open items first, most important first. Finished items sink to the bottom.
  const items = [...itemsQuery.records].sort(
    (a, b) =>
      Number(a.data.status === 'done') - Number(b.data.status === 'done') ||
      PRIORITY_ORDER[a.data.priority] - PRIORITY_ORDER[b.data.priority] ||
      a.data.timeSec - b.data.timeSec,
  )
  const doneCount = items.filter((item) => item.data.status === 'done').length

  async function makeList() {
    setIsMaking(true)
    try {
      await callAction('makeRevisionList', { trackId })
    } catch (err) {
      toast.error('Could not make the revision list', err instanceof Error ? err.message : undefined)
    } finally {
      setIsMaking(false)
    }
  }

  let summary = 'AI groups the comments into a prioritized checklist. Only you can see it.'
  if (comments.length === 0) summary = 'Once there are comments, AI can turn them into a checklist.'
  if (items.length > 0) {
    summary = `${doneCount} of ${items.length} done. Making it again replaces the open items and keeps the finished ones.`
  }

  return (
    <section
      aria-label="Revision list"
      data-testid="revision-list"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Revision list</h2>
          <p className="text-sm text-muted-foreground" data-testid="revision-summary">
            {summary}
          </p>
        </div>
        <Button
          className="shrink-0"
          disabled={isMaking || comments.length === 0}
          data-testid="make-revision-list"
          onClick={makeList}
        >
          {isMaking ? 'Reading the comments…' : items.length > 0 ? 'Make it again' : 'Make revision list'}
        </Button>
      </div>

      {itemsQuery.status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          Could not load the revision list. Reload the page to try again.
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ChecklistRow
              key={item.recordId}
              item={item}
              comments={comments}
              onSelectComment={onSelectComment}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ChecklistRow({
  item,
  comments,
  onSelectComment,
}: {
  item: RecordData<ChecklistItem>
  comments: RecordData<Comment>[]
  onSelectComment: (commentId: string) => void
}) {
  const { put, remove, ready } = useMutations<ChecklistItem>('checklist_items')
  const [draft, setDraft] = useState<string | null>(null) // null = not editing
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const isDone = item.data.status === 'done'
  // A source comment may have been deleted since the list was made.
  const sources = comments.filter((comment) => item.data.commentIds.includes(comment.recordId))

  function saveTitle() {
    if (draft === null || !draft.trim()) return
    void put(item.recordId, { title: draft.trim() })
    setDraft(null)
  }

  return (
    <li
      data-testid="checklist-item"
      className="flex items-start gap-3 rounded-md border border-border px-3 py-2"
    >
      <Checkbox
        className="mt-1"
        aria-label={`Done: ${item.data.title}`}
        data-testid="checklist-checkbox"
        checked={isDone}
        disabled={!ready}
        onCheckedChange={(checked) => void put(item.recordId, { status: checked ? 'done' : 'open' })}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {draft === null ? (
          <p className={cn('text-foreground', isDone && 'text-muted-foreground line-through')}>
            {item.data.title}
          </p>
        ) : (
          <div className="flex gap-2">
            <Input
              aria-label="Edit checklist item"
              value={draft}
              maxLength={MAX_CHECKLIST_TITLE_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveTitle()
                if (event.key === 'Escape') setDraft(null)
              }}
            />
            <Button size="sm" disabled={!ready || !draft.trim()} onClick={saveTitle}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Badge variant={PRIORITY_BADGE[item.data.priority]} size="sm">
            {item.data.priority}
          </Badge>
          {sources.length > 0 && <span>From comments at</span>}
          {sources.map((comment) => (
            <button
              key={comment.recordId}
              type="button"
              title={comment.data.body}
              data-testid="checklist-source"
              className="font-medium tabular-nums text-primary underline-offset-4 hover:underline"
              onClick={() => onSelectComment(comment.recordId)}
            >
              {formatTime(comment.data.timeSec)}
            </button>
          ))}
        </div>
      </div>

      {draft === null && (
        <span className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" disabled={!ready} onClick={() => setDraft(item.data.title)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" disabled={!ready} onClick={() => setIsConfirmingDelete(true)}>
            Delete
          </Button>
        </span>
      )}

      <ConfirmModal
        open={isConfirmingDelete}
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          void remove(item.recordId)
          setIsConfirmingDelete(false)
        }}
        title="Delete this checklist item?"
        description="This cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </li>
  )
}
