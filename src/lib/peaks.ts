/**
 * Waveform peaks, computed once in the uploader's browser.
 *
 * The audio is decoded with the Web Audio API and reduced to a few hundred
 * numbers between 0 and 1. Those are stored on the track record, so every
 * other client draws the waveform without downloading or decoding the audio.
 */

export const PEAK_COUNT = 800

export async function computePeaks(
  file: File,
  peakCount = PEAK_COUNT,
): Promise<{ peaks: number[]; durationSec: number }> {
  const audioContext = new AudioContext()
  try {
    const audio = await audioContext.decodeAudioData(await file.arrayBuffer())
    // The first channel is enough to show the shape of the track.
    const samples = audio.getChannelData(0)
    const samplesPerPeak = Math.max(1, Math.ceil(samples.length / peakCount))

    // One peak = the loudest sample in its slice of the track.
    const peaks: number[] = []
    for (let start = 0; start < samples.length; start += samplesPerPeak) {
      const end = Math.min(start + samplesPerPeak, samples.length)
      let loudest = 0
      for (let i = start; i < end; i++) {
        loudest = Math.max(loudest, Math.abs(samples[i]))
      }
      peaks.push(loudest)
    }

    // Scale so the loudest moment is 1, and round to keep the record small.
    const overallLoudest = Math.max(...peaks) || 1
    return {
      peaks: peaks.map((p) => Math.round((p / overallLoudest) * 1000) / 1000),
      durationSec: audio.duration,
    }
  } finally {
    await audioContext.close()
  }
}
