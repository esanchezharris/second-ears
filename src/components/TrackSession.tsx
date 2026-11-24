/**
 * TrackSession — the one screen of the product: play a track, see its
 * waveform, and read and write comments pinned to moments on it.
 *
 * Comments come from a live query, so a comment added by anyone in the
 * session appears here without a refresh. The other listeners' playheads
 * come from a presence room (src/hooks/useListeners.ts).
 *
 * Owner and reviewers both land here. The owner also gets the Share and
 * Delete controls; the server enforces that difference, not this file.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { CommentComposer } from '@/components/CommentComposer'
import { CommentList } from '@/components/CommentList'
import { PlayBar } from '@/components/PlayBar'
import { SharePanel } from '@/components/SharePanel'
import { Waveform } from '@/components/Waveform'
import { useListeners } from '@/hooks/useListeners'
import { usePlayer } from '@/hooks/usePlayer'
import { useTrackAudio } from '@/hooks/useTrackAudio'
import { callAction } from '@/lib/actions'
import type { Comment, Track } from '@/types'

export function TrackSession({ trackId, track }: { trackId: string; track: Track }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { userId } = useAuth()
  const isOwner = track.ownerId === userId
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const audio = useTrackAudio(`/api/tracks/${trackId}/audio`)
  const player = usePlayer()
  const { currentTime, seek } = player
  const listeners = useListeners(trackId, currentTime, player.isPlaying)

  // Where the next comment will be pinned. null = "wherever the playhead is".
  const [commentTime, setCommentTime] = useState<number | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)

  const commentsQuery = useQuery<Comment>('comments', { where: { trackId } })
  const comments = [...commentsQuery.records].sort((a, b) => a.data.timeSec - b.data.timeSec)

  async function deleteTrack() {
    setIsDeleting(true)
    try {
      await callAction('deleteTrack', { trackId })
      navigate('/tracks')
    } catch (err) {
      toast.error('Could not delete the track', err instanceof Error ? err.message : undefined)
      setIsDeleting(false)
      setIsConfirmingDelete(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="track-title">
          {track.title}
        </h1>
        {isOwner && (
          <div className="flex gap-2">
            <Button size="sm" data-testid="share-button" onClick={() => setIsSharing(!isSharing)}>
              {isSharing ? 'Close sharing' : 'Share'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(true)}>
              Delete track
            </Button>
          </div>
        )}
      </header>

      {isOwner && isSharing && <SharePanel trackId={trackId} track={track} />}

      <p
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
        data-testid="listeners"
      >
        Here now:
        <span>You</span>
        {listeners.map((listener) => (
          <span key={listener.userId} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: listener.color }} />
            {listener.name}
          </span>
        ))}
      </p>

      <ConfirmModal
        open={isConfirmingDelete}
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={deleteTrack}
        title="Delete this track?"
        description="The audio file and every comment on it will be deleted. This cannot be undone."
        confirmText="Delete track"
        variant="destructive"
        loading={isDeleting}
      />

      <section className="flex flex-col gap-3">
        {/* The bottom margin leaves room for the listeners' name tags. */}
        <div className="mb-4">
          <PlayBar audio={audio} player={player} durationSec={track.durationSec} />
        </div>

        <Waveform
          peaks={track.peaks}
          durationSec={track.durationSec}
          currentTime={currentTime}
          markers={comments.map((c) => ({
            id: c.recordId,
            timeSec: c.data.timeSec,
            label: c.data.body,
          }))}
          listeners={listeners}
          onSeek={(timeSec) => {
            seek(timeSec)
            setCommentTime(timeSec) // a click on the waveform also pins the next comment
          }}
          onMarkerClick={(commentId) => {
            setSelectedCommentId(commentId)
            const comment = comments.find((c) => c.recordId === commentId)
            if (comment) seek(comment.data.timeSec)
          }}
        />
      </section>

      <CommentComposer
        trackId={trackId}
        timeSec={commentTime ?? currentTime}
        onStartTyping={() => setCommentTime((pinned) => pinned ?? currentTime)}
        onAdded={() => setCommentTime(null)}
      />

      <CommentList
        comments={comments}
        status={commentsQuery.status}
        selectedCommentId={selectedCommentId}
        onSeek={seek}
      />
    </div>
  )
}
