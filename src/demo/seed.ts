/**
 * What a fresh demo session contains. Used only by the `openDemo` action.
 *
 * The audio is public/demo/sekko-w.mp3, shipped with the app. Its waveform
 * peaks were computed once by scripts/make-demo-peaks.mjs into peaks.json,
 * the same way an upload's peaks are computed once in the browser.
 *
 * The comments are written by hand. Their times follow the track's shape:
 * everything comes in at 0:04, a quieter section runs 1:00 to 1:24, the full
 * arrangement returns at 1:24, and the track ends at 1:56.
 */

import { DEMO_AUDIO_KEY } from '../types'
import demoAudio from './peaks.json'

export const DEMO_TRACK = {
  title: 'Sekko - W (demo)',
  audioKey: DEMO_AUDIO_KEY,
  durationSec: demoAudio.durationSec,
  peaks: demoAudio.peaks,
}

export const DEMO_COMMENTS: { authorId: string; timeSec: number; body: string }[] = [
  {
    authorId: 'demo-reviewer-maya',
    timeSec: 2,
    body: 'The intro is over before I have settled in. Maybe four more bars before everything comes in?',
  },
  {
    authorId: 'demo-reviewer-dev',
    timeSec: 5,
    body: 'Love how hard this entry hits. The low end is a bit boomy right here though.',
  },
  {
    authorId: 'demo-reviewer-jules',
    timeSec: 6,
    body: 'Agree with Dev. The bass is swallowing the drums when it all comes in.',
  },
  {
    authorId: 'demo-reviewer-maya',
    timeSec: 36,
    body: 'The loop has been the same for a while by this point. It could use a new element or a filter move.',
  },
  {
    authorId: 'demo-reviewer-dev',
    timeSec: 61,
    body: 'This quieter section is my favourite part of the track.',
  },
  {
    authorId: 'demo-reviewer-jules',
    timeSec: 60,
    body: 'The change into this section is abrupt. A short riser or a reverb tail would smooth it.',
  },
  {
    authorId: 'demo-reviewer-maya',
    timeSec: 85,
    body: 'When it all comes back in here it feels smaller than the first time. It should hit harder.',
  },
  {
    authorId: 'demo-reviewer-dev',
    timeSec: 86,
    body: 'Yes, the return needs more impact. Try dropping the drums for a beat just before it.',
  },
  {
    authorId: 'demo-reviewer-jules',
    timeSec: 113,
    body: 'The ending cuts out fast. A longer fade or a tail would finish it better.',
  },
]
