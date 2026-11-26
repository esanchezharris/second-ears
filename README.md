# Second Ears

A producer uploads a work-in-progress track and shares a link. Reviewers
listen and pin comments to moments on the waveform. Everyone in the session
sees each other's playheads and new comments live. One click turns the
comments into a prioritized revision checklist that the owner ticks off.

Live: https://second-ears.app.space
Code: https://github.com/esanchezharris/second-ears (a read-only copy; the
app deploys from DeepSpace source)

Built on [DeepSpace](https://docs.deep.space) as a take-home exercise. Every
decision, with the alternatives and the reasons, is in
[DECISIONS.md](DECISIONS.md). The summary of what was built, what is
unfinished and what comes next is in [SUBMISSION.md](SUBMISSION.md).

## Try it in two minutes

1. Open https://second-ears.app.space, click **Enter the app**, and sign in.
2. On **Tracks**, click **Open the demo session**. You get your own copy of a
   demo track with nine comments from three made-up reviewers.
3. Press **Play**. Click a comment's time, or a dot under the waveform, to
   jump to that moment.
4. Click **Make revision list**. After about seven seconds the AI has grouped
   the comments into a checklist. Tick, reword or delete items.
5. Click **Share**, create an invite link, and open it in a second browser
   signed in as someone else. You will see each other's playheads move, and
   comments appear without a refresh.

To see two people at once you need two separate sessions: a normal window and
a private window, or two browsers. Two tabs in one browser are one user.

## What each role can do

| | Owner | Reviewer | Viewer (public link) |
|---|---|---|---|
| Listen, see the waveform | yes | yes | yes |
| Read comments, see playheads | yes | yes | no |
| Add comments, edit or delete own | yes | yes | no |
| Share, remove reviewers, delete the track | yes | no | no |
| Make and work on the revision list | yes | no | no |

- **Owner** is whoever uploaded the track (or opened the demo).
- **Reviewer** is anyone who opened the owner's invite link while signed in.
- **Viewer** is anyone with the public listen-only link, signed in or not.
  The owner switches that link on and off.

These rules are enforced on the server, in the collection schemas and the
server actions. The pages hide controls a role cannot use, but hiding is not
the protection.

## How it is built

The whole product is one screen, `src/components/TrackSession.tsx`. The parts:

| Where | What |
|---|---|
| `src/schemas/` | One file per collection, with its permission rules. Start here. |
| `src/actions/` | Server actions: everything that must be checked on the server before a write (create a track, add a comment, redeem an invite, run the AI). |
| `src/actions/track-access.ts` | The one function that answers "what may this user do on this track?" |
| `src/actions/paid-calls.ts` | The spending guard in front of AI and email. |
| `src/server/track-routes.ts` | Audio for members, and the public listen-only routes. |
| `src/server/realtime-routes.ts` | The gate in front of the presence room. |
| `src/pages/` | File-based routes. `(app)/(protected)/` requires sign-in. |
| `src/components/`, `src/hooks/` | The session screen and its pieces. |
| `src/demo/` | The demo session's seed data. |
| `tests/` | Browser tests with real signed-in users (Playwright). |

Collections: `tracks`, `team_members` (who is owner or reviewer of which
track), `comments`, `invites`, `checklist_items`, `paid_calls`, plus the
platform's `users`.

### DeepSpace primitives used

| Need | Primitive |
|---|---|
| Sign-in | `AuthGate`, `useAuth`, verified JWTs in the worker |
| Data and live updates | records with `useQuery` / `useMutations`; realtime sync is built in |
| Permissions | schema rules: `'team'` reads through `team_members`, `'own'` writes, `writableFields`, `uniqueOn`, `immutable`, `maxLength` |
| Per-track roles | `team_members` rows, written only by server actions |
| Presence playheads | `usePresenceRoom`, with a membership check in the worker route |
| Audio files | file storage: `useR2Files` in the browser, `appFiles` in the worker |
| Server-checked writes | server actions (`POST /api/actions/<name>`) |
| AI | `createDeepSpaceAI` with tool use over the comment and checklist records |
| Email | `email/send` through the integration proxy, from a server action |
| Tests | `deepspace/testing` (`users(N)` gives real signed-in browser contexts) |

Nothing here hand-rolls websockets, auth or storage.

## Integrations and what they cost

Both are billed to the app owner, so both sit behind sign-in, an ownership
check and a rate limit. Neither can be called from a browser directly.

| Integration | Used for | Cost | Limits |
|---|---|---|---|
| AI (Anthropic, `claude-haiku-5-5`) | The revision list | about $0.001 per list | owner only; one per track per 5 minutes; 20 per user per 24 hours |
| `email/send` | One email to the owner when a reviewer leaves the first comment on a track | $0.013 per email | once per track, ever; 10 per owner per 24 hours |

Left out on purpose: speech-to-text for voice-note comments (the catalog has
it; the core path came first), payments, LiveKit listening parties, version
comparison, DAW integration, a mobile app.

## Run it

Needs Node 22.15+ or 24, npm 11.6+, and a DeepSpace login
(`npx deepspace auth login`).

```bash
npm install
npx deepspace dev start      # local app with live reload
npx deepspace test run       # quick checks: smoke and API tests
npx deepspace test run all   # everything: unit tests and all browser tests
npx deepspace deploy         # commit first: deploy refuses uncommitted changes
```

Things to know before running the tests:

- The browser tests sign in as real test accounts. Create two once with
  `npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin`.
  Without them, those tests skip.
- `tests/revision.spec.ts` makes one real AI call per run (about a tenth of a
  cent, billed to the app owner). No test sends email: test accounts are on
  the `.test` domain, which the app never emails.
- Tests run against a local database but the real platform file storage. Each
  test deletes the track it uploads.

If the demo audio is ever replaced, regenerate its waveform with
`node scripts/make-demo-peaks.mjs` (needs ffmpeg).

To update the public copy on GitHub after new commits, run
`scripts/publish-github.sh` (needs the GitHub CLI, signed in).

## Known limits

The full list, with reasons, is under "Known edges" in each milestone of
[DECISIONS.md](DECISIONS.md). The ones a visitor is most likely to meet:

- A reviewer who joins a track sees it in an already-open Tracks tab only
  after a reload.
- The revision list can be made once per track per five minutes. A failed
  attempt counts.
- The owner cannot delete other people's comments.
- Audio is downloaded whole before it plays (uploads are capped at 20 MB).
- The free plan gives the app 128 MB of file storage in total: about six
  tracks at the cap. Demo tracks use none of it.
- The demo's audio file ships with the app as a static file, so anyone who
  knows its URL can download it without signing in.
- The waveform cannot be operated from the keyboard.
- The look is the scaffold's default theme.
