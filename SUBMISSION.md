# Second Ears — submission note

Live: https://second-ears.app.space
Code: https://github.com/esanchezharris/second-ears
Code map and run instructions: [README.md](README.md)
Every decision with its alternatives: [DECISIONS.md](DECISIONS.md) (D1–D38)

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
   tick, reword and delete them. Making the list again keeps the items the
   owner finished or reworded and replaces the rest.
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
  - Milestone 4: making the list again replaced an item the owner had
    reworded. The agent had chosen that and logged it as an edge (D27);
    the live check on 2026-11-25 reported it as a failure and it was
    changed (D37).
  - Milestone 6: edits had no server-side length limit. The agent listed it
    as a defect instead of fixing it unasked; fixed afterwards on request
    (D36).

## 6. What I verified or changed

The agent wrote this section from my answers to its questions. Sections 1 to
5, 7 and 8 it wrote from DECISIONS.md, the code and the test runs.

**Decisions I made**

- Approved the Milestone 0 plan as written.
- Chose DeepSpace source over GitHub source, and signed in to the CLI
  through the browser myself.
- Approved creating two test accounts.
- Chose the recipient of the email test call.
- Supplied the demo track.
- After the first draft of this note, told the agent to add the server-side
  length limit on edits (D36).
- Chose a public GitHub copy of the code (D38).
- Chose to leave the demo comments as they are (see below).

Apart from these I did not overrule or redirect the agent. I accepted its
proposals at each checkpoint.

**What I verified**

- The live checks on 2026-11-25 were run by another AI assistant at my
  direction, signed in as me (owner) and as the Reviewer test account.
  Thirteen passed and one failed. The table is in DECISIONS.md under "Live
  checks, 2026-11-25".
- I saw three of them with my own eyes: the playheads and live comments, the
  first-comment email in my own inbox, and the AI revision list. The others
  I know from the assistant's report.
- The one failure: making the list again overwrote an item that had been
  reworded. I passed it to the agent, which fixed it (D37). The fix has not
  been rechecked on the live site.
- I heard the demo track play on the live site.
- The revision list's grouping looked right to me.

**What I did not verify**

- The nine demo comments. The agent wrote them without hearing the track
  and I have not checked them against it. They are examples.
- No corrections are logged for Milestones 3, 4 and 5, because I reported
  none to the agent at the time.

**What I changed by hand**

- Nothing. Every commit came from the agent at my direction.

**Code I have read**

- The schemas (`src/schemas`), closely enough to explain line by line. Not
  yet the server actions or the session screen.

**What I would do differently**

- Give more product direction: make more of the product decisions myself
  instead of accepting the agent's defaults.

## 7. What is unfinished

Not verified:

- The live checks of 2026-11-25 covered the core path with two accounts in
  one browser (table in DECISIONS.md). Not covered: wav upload on live,
  mobile, other browsers, more than two people at once.
- "Make it again" keeping a reworded item, on the live URL. It was fixed
  after the live checks and proven locally with two real AI runs; no
  permanent test runs the AI twice.
- Whether the nine demo comments are true of the track. Left unchecked by
  choice; they are examples.
- The length limits on edits, on the live URL. The limit on track title
  edits is untested anywhere: the app has no rename control to test it with.
- The crash screen, the "browser could not play the audio" message and the
  "storage full" message: built, never triggered.

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
