/**
 * TrackSession — the one screen of the product: play a track, see its
 * waveform, and read and write comments pinned to moments on it.
 *
 * Comments come from a live query, so a comment added by anyone in the
 * session appears here without a refresh.
 */

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { CommentComposer } from '@/components/CommentComposer'
import { CommentList } from '@/components/CommentList'
import { Waveform } from '@/components/Waveform'
import { useTrackAudio } from '@/hooks/useTrackAudio'
import { callAction } from '@/lib/actions'
import { formatTime } from '@/lib/format'
import type { Comment, Track } from '@/types'

export function TrackSession({ trackId, track }: { trackId: string; track: Track }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { userId } = useAuth()
  const isOwner = track.ownerId === userId
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const audio = useTrackAudio(trackId)
  const audioElement = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Where the next comment will be pinned. null = "wherever the playhead is".
  const [commentTime, setCommentTime] = useState<number | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)

  const commentsQuery = useQuery<Comment>('comments', { where: { trackId } })
  const comments = [...commentsQuery.records].sort((a, b) => a.data.timeSec - b.data.timeSec)

  function seek(timeSec: number) {
    setCurrentTime(timeSec)
    if (audioElement.current) audioElement.current.currentTime = timeSec
  }

  function togglePlay() {
    const element = audioElement.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }

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
          <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(true)}>
            Delete track
          </Button>
        )}
      </header>

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
        <div className="flex items-center gap-3">
          <Button onClick={togglePlay} disabled={!audio.url} data-testid="play-button">
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(track.durationSec)}
          </span>
          {audio.status === 'loading' && (
            <span className="text-sm text-muted-foreground">Loading audio…</span>
          )}
          {audio.status === 'error' && (
            <span role="alert" className="flex items-center gap-2 text-sm text-destructive">
              {audio.error}
              <Button variant="outline" size="sm" onClick={audio.retry}>
                Retry
              </Button>
            </span>
          )}
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

        {audio.url && (
          <audio
            ref={audioElement}
            src={audio.url}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
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
