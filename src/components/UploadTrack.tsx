/**
 * UploadTrack — pick an mp3 or wav and turn it into a track.
 *
 * Three steps, in order:
 *   1. decode the file in the browser and compute its waveform peaks
 *   2. upload the file to the user's private file storage
 *   3. call the `createTrack` server action, which writes the track record
 */

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useR2Files } from 'deepspace'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { computePeaks } from '@/lib/peaks'
import { MAX_AUDIO_BYTES, MAX_TITLE_LENGTH } from '@/types'

type Step = 'idle' | 'reading' | 'uploading' | 'saving'

const STEP_LABEL: Record<Step, string> = {
  idle: 'Upload a track',
  reading: 'Reading audio…',
  uploading: 'Uploading…',
  saving: 'Saving…',
}

function isMp3OrWav(file: File): boolean {
  return /\.(mp3|wav)$/i.test(file.name)
}

export function UploadTrack() {
  const navigate = useNavigate()
  const { upload, deleteFile } = useR2Files() // default scope: private to this user
  const fileInput = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!isMp3OrWav(file)) return setError('Choose an .mp3 or .wav file.')
    if (file.size > MAX_AUDIO_BYTES) return setError('That file is over the 20 MB limit.')

    let uploadedKey: string | undefined
    try {
      setStep('reading')
      const { peaks, durationSec } = await computePeaks(file).catch(() => {
        throw new Error('That file could not be read as audio.')
      })

      setStep('uploading')
      const uploaded = await upload(file, file.name)
      if (!uploaded.success || !uploaded.key) {
        throw new Error(uploaded.error ?? 'The upload failed. Please try again.')
      }
      uploadedKey = uploaded.key

      setStep('saving')
      const title = file.name.replace(/\.(mp3|wav)$/i, '').slice(0, MAX_TITLE_LENGTH)
      const { trackId } = await callAction<{ trackId: string }>('createTrack', {
        title,
        audioKey: uploaded.key,
        durationSec,
        peaks,
      })
      navigate(`/t/${trackId}`)
    } catch (err) {
      // Do not leave an uploaded file behind if the track was never created.
      if (uploadedKey) void deleteFile(uploadedKey)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setStep('idle')
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={fileInput}
        data-testid="upload-input"
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = '' // allow picking the same file again
          if (file) void handleFile(file)
        }}
      />
      <Button disabled={step !== 'idle'} onClick={() => fileInput.current?.click()}>
        {STEP_LABEL[step]}
      </Button>
      <p className="text-xs text-muted-foreground">mp3 or wav, up to 20 MB.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
