# Second Ears — submission note (DRAFT)

> **Draft written by the agent from DECISIONS.md.** Everything below is taken
> from that log, the code and the test runs. Section 6 is yours, Emilio: it
> holds prompts, not answers, because the agent does not know what you
> checked or changed. Delete this box and the prompts before you submit.

Live: https://second-ears.app.space
Code map and run instructions: [README.md](README.md)
Every decision with its alternatives: [DECISIONS.md](DECISIONS.md) (D1–D36)

## 1. What was built

A producer uploads a work-in-progress track and shares a link. Reviewers
listen and pin comments to moments on the waveform. Everyone in the session
sees each other's playheads and new comments live. One click turns the
comments into a prioritized revision checklist the owner ticks off.

The six steps of the core path, as deployed:

1. **Upload.** Sign in, upload an mp3 or wav (20 MB cap). The browser
   computes the waveform peaks once and they are stored on the track record.
2. **Share.** An invite link makes whoever opens it a reviewer. A separate
   public link, off by default, is listen-only: no comments, no sign-in.
3. **Comment.** Click the waveform, write a comment. It appears for everyone
   in the session without a refresh.
4. **Presence.** Each listener's playhead is drawn with their name and
   colour, sent at most four times a second and only when it changes.
5. **Revision list.** The owner clicks "Make revision list". The AI reads the
   comment records, groups the ones about the same issue, and writes
   checklist records that link back to their source comments. The owner can
   tick, reword and delete them.
6. **Email.** The owner gets one email when a reviewer leaves the first
   comment on a track, and none after that.

Also built: a demo session (each signed-in visitor can open their own copy of
a track with nine seeded reviewer comments, so the app is not empty for one
person), owner-only removal of reviewers and deletion of tracks, and
loading, empty and error states on every page.

### Why this idea

- Each feature maps to one DeepSpace primitive, so the app shows the platform
  rather than working around it (table in section 2).
- It looks alive for a single reviewer, because of the demo session.
- It is a problem I have: I produce music.
- The core is one screen.

## 2. Platform primitives and integrations, and why

| Need | Primitive | Why this one |
|---|---|---|
| Sign-in | `AuthGate`, `useAuth`, JWT verification in the worker | Platform auth; nothing hand-rolled |
| Data and live updates | records (`useQuery`, `useMutations`) | Realtime sync comes with the records; no websocket code |
| Per-track roles | `team_members` rows with the `'team'` permission level | Built-in roles are app-wide; the product needs roles per track (D1) |
| Field-level rules | `'own'`, `writableFields`, `immutable`, `uniqueOn`, `maxLength` | Edits and deletes are enforced by the schema, not the page |
| Writes that need a check | server actions | A schema's `create` is yes or no; it cannot say "only members of this track" (D2) |
| Playheads | presence rooms (`usePresenceRoom`) | Volatile state that should not be stored |
| Audio | file storage (`useR2Files`, `appFiles`) | Private files, streamed by a worker route after a membership check (D3) |
| AI | `createDeepSpaceAI` with tool use over records | Two narrow tools: list this track's comments, add an item to this track (D23) |
| Email | `email/send` through the integration proxy | One notification per track (D26) |
| Tests | `deepspace/testing` | Real signed-in users in separate browser contexts |

**Integrations used: two.**

- **AI** (Anthropic, `claude-haiku-5-5`): the revision list is the product's
  payoff. About $0.001 per list.
- **Email** (`email/send`): the owner needs to know feedback has started.
  $0.013 per email.

Both are billed to the app owner, so both are behind sign-in, an ownership
check and a rate limit, and neither can be called from a browser. Before
each was used the agent ran `integrations info` and made one real test call
(AI $0.0001, email $0.013). Total spend during the build: under $0.02.

**Left out on purpose.** Speech-to-text for voice-note comments is in the
catalog and was allowed as a third integration only once the core path was
finished; time went to the demo, error states and tests instead. Also cut:
payments, LiveKit listening parties, version comparison, DAW integration, a
mobile app.

## 3. The main tradeoff

**Authorization lives in two places.** DeepSpace roles are app-wide, and a
schema's `create` rule is a plain yes or no. Per-track roles therefore became
rows in `team_members`: reads, edits and deletes are enforced by schema rules
(`'team'`, `'own'`), but every create that depends on membership (a track, a
comment, a membership, a checklist item) goes through a server action that
checks the membership row first.

- **What it costs.** The docs advise against permission logic in actions.
  Server actions run with record permissions off, so each one must remember
  to check. That check is one function, `getTrackRole`, and the tests call
  each action as the wrong user to prove it refuses.
- **What the alternative costs.** `create: true` for every signed-in user
  would let anyone forge a comment onto any track id.

Two smaller ones:

- **Spending limits use fixed five-minute windows** claimed through a unique
  database row, instead of "last run" timestamps. Two simultaneous requests
  cannot both pass, but a list made at 12:04 can be made again at 12:05 (D24).
- **Audio is downloaded whole before it plays.** The route needs an
  `Authorization` header, which an `<audio>` tag cannot send. Fine at a 20 MB
  cap; larger files would need range requests (D11).

## 4. Things found in the platform along the way

- **Presence rooms accept anyone by default**, signed in or not. A membership
  check was added in the worker route (D17).
- **The scaffold's integration proxy let any signed-in user call any
  owner-billed integration**, including sending email to any address. It was
  closed; AI and email are reachable only through server actions (D25).
- **A membership change does not refresh already-open pages.** The SDK's
  refresh code reads a field named `UserId`; the docs name the column
  `userId`. The documented name was kept. Removal is handled by watching the
  membership row; joining is not, so a reviewer sees a new track in an
  already-open Tracks tab only after a reload (D20).
- **The email guide and the live catalog disagree** about the sender address.
  The catalog's version was followed (D7).
- **The scaffold's crash screen showed the raw error and stack trace** to
  every user. A deployed build now shows a plain sentence (D33).
- **Production serves a static mp3 as `application/octet-stream`**; local dev
  says `audio/mpeg`. The audio route now sets the type itself (D30).

## 5. What the agent did

Claude Code (Claude Fable 5.2) worked from the brief in six milestones and
stopped for a go-ahead after each one.

- **Planned.** Read the DeepSpace docs first and wrote a plan (D1–D7), which
  was approved without changes.
- **Wrote all the code**: schemas, eight server actions, worker routes, the
  session screen and its components, the demo seed, 11 unit tests and 21
  browser tests, README, DECISIONS.md and this draft.
- **Tested locally** after every milestone with two real test accounts in
  separate browser contexts plus a signed-out browser, and deployed.
- **Checked the live URL only while signed out**: that actions, audio,
  presence and integrations refuse a caller with no session.
- **Did not do, by rule or by nature:**
  - Did not sign in on the live site. It does not enter passwords on
    production, so every signed-in flow on the live URL is unverified by it.
  - Did not hear the demo track. It measured loudness over time and wrote
    the nine demo comments to fit the track's shape (D32).
  - Did not create accounts or choose an email recipient without asking.
- **Where it was wrong or had to go back:**
  - Milestone 1: the first deploy still showed the scaffold's page title.
    Fixed in a second deploy.
  - Milestone 3: a removed reviewer's open page stayed live. Found by its
    own probe test before the milestone was reported, then fixed.
  - Milestone 4: the plan's timestamp rate limit could be passed by two
    simultaneous requests. Replaced with the unique-row design.
  - Milestone 5: the "Hello world" sentence from Milestone 1 was still on
    the landing page. The mp3 content-type problem was found only after
    deploying. One new test could collide with another running in parallel;
    fixed before commit.
  - Milestone 6: edits had no server-side length limit. The agent listed it
    as a defect instead of fixing it unasked; fixed afterwards on request
    (D36).

## 6. What I verified or changed

> **Emilio: this section is yours.** What is on record is listed first. The
> prompts are questions only you can answer. If the answer to one is "I did
> not check", say that.

On record in DECISIONS.md:

- Approved the Milestone 0 plan as written.
- Chose DeepSpace source over GitHub source, and signed in to the CLI
  through the browser myself.
- Approved creating two test accounts.
- Chose the recipient of the email test call.
- Supplied the demo track.
- After the draft of this note, told the agent to add the server-side
  length limit on edits (D36).
- No corrections are logged for Milestones 3, 4 and 5: none were reported
  to the agent.

To fill in:

- [ ] **Two-browser check (Milestone 3).** Did you open the live app in two
  browsers as two users? Which accounts? Did playheads move, comments arrive
  live, and the removed reviewer get locked out?
- [ ] **Sign-in hand-off.** Did a signed-out visitor who opened an invite
  link get carried through to the track after signing in?
- [ ] **Revision list on live.** Did you run it on a real track? Was the
  grouping right? Anything you would not act on?
- [ ] **The email.** Did the first-comment email arrive, once? Did a second
  comment stay silent?
- [ ] **Demo on live.** Did the demo track play? In which browsers?
- [ ] **Demo comments.** Which of the nine did you rewrite to be true of the
  track?
- [ ] **Code you changed by hand.** Files and why. If none, say none.
- [ ] **Code you read line by line.** Which files can you explain without
  notes? Which did you skim?
- [ ] **Where you overruled or redirected the agent.** Anything beyond the
  list above.
- [ ] **What you would have done differently** in how you directed it.

## 7. What is unfinished

Not verified:

- Every signed-in flow on the live URL, unless section 6 says otherwise.
- A real first-comment email sent by the app. The test call proved the
  integration; the app's own path is covered by unit tests with fake tools.
- "Make it again" keeping ticked items: built, but no test runs the AI twice.
- The crash screen, the "browser could not play the audio" message and the
  "storage full" message: built, never triggered.
- The length limit on track title edits: in the schema, but the app has no
  rename control to test it with. The limits on comment and checklist edits
  are tested.

Known defects and edges:

- A reviewer who joins sees the track in an already-open Tracks tab only
  after a reload (the SDK issue in section 4).
- An edit refused for being too long fails silently: the page shows the long
  text until the next reload. Only an edit sent around the page can be
  refused (D36).
- The per-user daily caps are read-then-write, so a burst across many tracks
  could pass a few extra. The per-track limit is exact.
- Presence is per user, not per tab.
- The demo's audio is a public static file.
- A track owner cannot delete other people's comments; a reviewer cannot
  leave a track; invite links do not expire.

Not built:

- Voice-note comments (speech-to-text).
- Renaming a track (the title is the file name).
- Keyboard control of the waveform.
- A visual design of its own: the look is the scaffold's default theme.
- A read-only copy of the code on GitHub for reviewers.

## 8. What next

1. Report the `UserId` / `userId` mismatch to DeepSpace; until it is fixed,
   refresh the Tracks list when the user's membership rows change.
2. Voice-note comments: record in the browser, transcribe with the catalog's
   speech-to-text, store the transcript as the comment body.
3. Let the owner delete any comment on their track, and let a reviewer leave.
4. Keyboard control of the waveform, and a design pass.
5. Range requests on the audio route, so the 20 MB cap can be raised.
6. Version comparison: upload a new mix of the same track and carry the open
   checklist items across.
