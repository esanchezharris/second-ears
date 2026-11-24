/**
 * SharePanel — the owner's controls for who can hear a track.
 *
 *   Invite link   whoever opens it and signs in becomes a reviewer
 *   Public link   anyone can listen; no comments, no sign-in
 *   Reviewers     the people who used the invite link, with a Remove button
 *
 * Only the owner sees this panel, but hiding it is not the protection. The
 * server checks ownership in the `createInviteLink` and `removeReviewer`
 * actions, and the schemas let only the owner read an invite or change
 * `visibility`.
 */

import { useState } from 'react'
import { useMutations, useQuery, useUserLookup } from 'deepspace'
import { Button, Input, Switch, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import type { Invite, TeamMember, Track } from '@/types'

export function SharePanel({ trackId, track }: { trackId: string; track: Track }) {
  const toast = useToast()
  const { getName } = useUserLookup()
  const tracks = useMutations<Track>('tracks')
  const invites = useMutations<Invite>('invites')
  const [isBusy, setIsBusy] = useState(false)

  const inviteQuery = useQuery<Invite>('invites', { where: { trackId } })
  const invite = inviteQuery.records[0]
  const membersQuery = useQuery<TeamMember>('team_members', { where: { teamId: trackId } })
  const reviewers = membersQuery.records.filter((member) => member.data.role === 'reviewer')

  const isPublic = track.visibility === 'public'
  const origin = window.location.origin

  /** Run a server action, with the buttons disabled while it is in flight. */
  async function run(action: string, params: Record<string, unknown>, failureTitle: string) {
    setIsBusy(true)
    try {
      await callAction(action, params)
    } catch (err) {
      toast.error(failureTitle, err instanceof Error ? err.message : undefined)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section
      aria-label="Share this track"
      data-testid="share-panel"
      className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4"
    >
      {(inviteQuery.status === 'error' || membersQuery.status === 'error') && (
        <p role="alert" className="text-sm text-destructive">
          Could not load the sharing settings. Reload the page to try again.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Invite reviewers</h2>
        <p className="text-sm text-muted-foreground">
          Anyone who opens this link and signs in can listen and comment.
        </p>
        {invite ? (
          <>
            <LinkRow url={`${origin}/join/${invite.recordId}`} testId="invite-link" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => run('createInviteLink', { trackId }, 'Could not make a new link')}
              >
                Replace with a new link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!invites.ready}
                onClick={() => void invites.remove(invite.recordId)}
              >
                Turn off
              </Button>
            </div>
          </>
        ) : (
          <Button
            className="self-start"
            disabled={isBusy || inviteQuery.status !== 'ready'}
            data-testid="create-invite"
            onClick={() => run('createInviteLink', { trackId }, 'Could not make the link')}
          >
            Create invite link
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
          <Switch
            checked={isPublic}
            disabled={!tracks.ready}
            data-testid="public-switch"
            onCheckedChange={(checked) =>
              void tracks.put(trackId, { visibility: checked ? 'public' : 'private' })
            }
          />
          Public listen-only link
        </label>
        <p className="text-sm text-muted-foreground">
          Anyone with this link can listen without signing in. They cannot see or add comments.
        </p>
        {isPublic && <LinkRow url={`${origin}/listen/${trackId}`} testId="public-link" />}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Reviewers</h2>
        {reviewers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has joined yet.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="reviewer-list">
            {reviewers.map((reviewer) => (
              <li key={reviewer.recordId} className="flex items-center justify-between text-sm">
                <span>{getName(reviewer.data.userId) ?? 'Someone'}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={() =>
                    run(
                      'removeReviewer',
                      { trackId, reviewerId: reviewer.data.userId },
                      'Could not remove the reviewer',
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** A link in a read-only box with a Copy button. */
function LinkRow({ url, testId }: { url: string; testId: string }) {
  const toast = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link', 'Select it in the box and copy it by hand.')
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={url}
        aria-label="Link"
        data-testid={testId}
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button variant="outline" onClick={copy}>
        Copy
      </Button>
    </div>
  )
}
