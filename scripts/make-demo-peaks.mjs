/**
 * Computes the waveform peaks for the bundled demo track, once, and writes
 * them to src/demo/peaks.json. Run it again only if the demo audio changes:
 *
 *   node scripts/make-demo-peaks.mjs
 *
 * It does what src/lib/peaks.ts does in the browser for an upload (loudest
 * sample per slice of the first channel, scaled so the loudest is 1), but
 * decodes with ffmpeg because Node has no Web Audio API. Needs ffmpeg.
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const AUDIO = 'public/demo/sekko-w.mp3'
const OUTPUT = 'src/demo/peaks.json'
const PEAK_COUNT = 800 // same as PEAK_COUNT in src/lib/peaks.ts
const SAMPLE_RATE = 44100

// First channel only, as raw 32-bit float samples.
const raw = execFileSync(
  'ffmpeg',
  ['-v', 'error', '-i', AUDIO, '-af', 'pan=mono|c0=c0', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-'],
  { maxBuffer: 1024 * 1024 * 1024 },
)
const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
const samplesPerPeak = Math.max(1, Math.ceil(samples.length / PEAK_COUNT))

const peaks = []
for (let start = 0; start < samples.length; start += samplesPerPeak) {
  const end = Math.min(start + samplesPerPeak, samples.length)
  let loudest = 0
  for (let i = start; i < end; i++) loudest = Math.max(loudest, Math.abs(samples[i]))
  peaks.push(loudest)
}

const overallLoudest = Math.max(...peaks) || 1
const durationSec = Math.round((samples.length / SAMPLE_RATE) * 1000) / 1000
const scaled = peaks.map((p) => Math.round((p / overallLoudest) * 1000) / 1000)

writeFileSync(OUTPUT, JSON.stringify({ durationSec, peaks: scaled }) + '\n')
console.log(`${OUTPUT}: ${scaled.length} peaks, ${durationSec} seconds`)
