# DECISIONS.md — Second Ears

A running log: each decision, the alternatives considered, and why. Entries are
appended after every milestone. Anything Emilio corrected or changed by hand is
logged under "Corrections by Emilio" so the submission note stays honest.

---

## Milestone 0 — plan (approved 2026-11-23, no changes requested)

### D1. Per-track roles are rows in `team_members`, not app roles

- **Decision.** Owner and reviewer are rows in a `team_members` collection
  (`teamId` = track id, `userId`, `status`, `role`). Collections that belong to
  a track carry a `trackId` column declared as `teamField`, and use the SDK's
  `'team'` permission level for reads.
- **Why.** DeepSpace's built-in roles (`viewer` / `member` / `admin`) apply to
  the whole app. The product needs roles per track. `'team'` is the SDK's
  server-enforced way to scope rows to a membership list.
- **Alternatives.** (a) A `reviewerIds` JSON array on the track with
  `'shared'`: works for the track row but comment rows cannot look at their
  parent's array. (b) One RecordRoom per track using built-in roles: the docs
  steer away from many rooms, and server actions target the main room.

### D2. Creates that depend on track membership go through server actions

- **Decision.** `createTrack`, `redeemInvite`, `addComment`,
  `makeRevisionList` are server actions. Reads, updates and deletes stay in
  schema rules (`'team'`, `'own'`, `writableFields`).
- **Why.** `create` in a permissions block is a boolean. A schema cannot say
  "only reviewers of this track may create a comment". An action can check the
  membership row first. `addComment` also has to run server-side anyway to
  send the one-time email.
- **Alternative.** `create: true` for every signed-in user: simpler, but any
  signed-in user could forge a comment onto any track id.
- **Tradeoff accepted.** The docs advise against RBAC logic in actions; here
  it is one membership check per action because the schema cannot express it.

### D3. Audio is stored privately and served through a worker route

- **Decision.** Upload with `useR2Files()` in the private (`self`) scope.
  `GET /api/tracks/:id/audio` checks membership (or the public flag) and
  streams the file with the worker helper `appFiles`.
- **Why.** File storage has two read modes only: private to the uploader, or
  public to anyone with the URL. Neither is "shared with reviewers".
- **Fallback if the route fights us.** Public scope with an unguessable key.
  Weaker: anyone holding the URL can download, and removing a reviewer does
  not revoke it.

### D4. Waveform peaks are computed once, in the uploader's browser

- **Decision.** Decode with Web Audio at upload, reduce to about 800 peak
  values, store as JSON on the track record.
- **Why.** Other clients draw the waveform from the record without decoding
  the audio. No server-side audio processing to build or pay for.

### D5. Public link is a read-only projection, not a role

- **Decision.** `/listen/:trackId` calls a worker route that returns title,
  peaks, duration and audio only when `visibility === 'public'`. Public
  viewers get no comments and no playheads.
- **Why.** Signed-out sockets then get nothing from any collection, which is a
  simple rule to state and test. A signed-in stranger has the app role
  `member`, so a schema rule could not tell them apart from a reviewer.

### D6. AI revision list uses tool use over records, owner-billed, rate-limited

- **Decision.** `makeRevisionList` runs a model through `createDeepSpaceAI`
  with two tools bound to one track: list comments, add checklist item. Only
  the track owner can call it; `lastRevisionAt` on the track allows one run
  per 5 minutes. Regenerating replaces unchecked items and keeps checked ones.
- **Why.** The brief asks for the platform's AI-over-records primitive. Two
  narrow tools are safer than the generic record tools because the model
  cannot touch any other track or collection.
- **Fallback.** One `anthropic/chat-completion` call that returns JSON, which
  the action validates and writes.

### D7. One email per track, on the first reviewer comment

- **Decision.** `addComment` sends `email/send` once and stamps
  `firstCommentEmailedAt` on the track.
- **Why.** "Not one email per comment." A per-track flag is the smallest
  thing that guarantees it.
- **Docs conflict.** The guide says to send from `<app>@app.space`. The live
  catalog says any `from` is ignored and mail comes from
  `notifications@updates.app.space`. Trusting the catalog; using `reply_to`.

### Integrations (why each is used or left out)

| Integration | Status | Why |
|---|---|---|
| AI (Anthropic via the proxy) | planned, Milestone 4 | The revision list is the product's payoff. |
| `email/send` | planned, Milestone 4 | The owner needs to know feedback arrived. |
| `speech/speech-to-text` | exists in catalog; optional | Voice-note comments, only if the core path is finished. |
| LiveKit, payments, others | left out | Not needed by the core path. Deliberate cuts. |

### Platform primitives in use (running list)

Auth (`AuthGate`, `useAuth`), records (`useQuery`, `useMutations`), schema
RBAC (`'team'`, `'own'`, `writableFields`, `uniqueOn`), realtime sync,
presence rooms (`usePresenceRoom`), file storage (`useR2Files`, `appFiles`),
server actions, integration proxy, AI (`createDeepSpaceAI`), testing fixture
(`deepspace/testing`), CLI deploy.

### Known caveats recorded at plan time

- The app owner (Emilio) is `admin` and can read every track.
- A track owner cannot delete other people's comments in this version.
- Free plan file storage is 128 MiB per app: about six tracks at the 20 MB cap.
- Presence rooms may not be permission-gated; to verify in Milestone 3.

### Corrections by Emilio

- None at Milestone 0. The plan was approved as written.

---

## Milestone 1 — scaffold and hello-world deploy

### D8. Starter template, project in `second-ears/`

- **Decision.** `npm create deepspace@latest second-ears` with the default
  `starter` template (SDK 0.44.2).
- **Alternatives.** `copilot` (ships an AI chat dock we do not need),
  `public-board` (anonymous writes, the opposite of our rules).
