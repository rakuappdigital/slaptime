import { useCallback, useEffect, useRef, useState } from 'react'

export type Sensitivity = 'low' | 'medium' | 'high'
export type SoundChoice = 'random' | string

export const SOUND_OPTIONS: { id: string; label: string; url: string }[] = [
  { id: 'anime', label: 'Anime', url: '/sounds/anime.mp3' },
  { id: 'anm', label: 'Anm', url: '/sounds/anm.mp3' },
  { id: 'anm2', label: 'Anm 2', url: '/sounds/anm2.mp3' },
  { id: 'spap', label: 'Spap', url: '/sounds/spap.mp3' },
]

const FFT_SIZE = 1024
const MIN_ABS_PEAK = 0.195
const BASELINE_SMOOTHING = 0.02
const MIN_MS_BETWEEN_SLAPS = 250

const JUMP_BY_SENSITIVITY: Record<Sensitivity, number> = {
  low: 0.585,
  medium: 0.39,
  high: 0.234,
}

async function loadSlapSounds(ctx: AudioContext) {
  const buffers = new Map<string, AudioBuffer>()
  await Promise.all(
    SOUND_OPTIONS.map(async (sound) => {
      const response = await fetch(sound.url)
      const arrayBuffer = await response.arrayBuffer()
      buffers.set(sound.id, await ctx.decodeAudioData(arrayBuffer))
    }),
  )
  return buffers
}

function playSlapSound(ctx: AudioContext, buffers: Map<string, AudioBuffer>, choice: SoundChoice) {
  if (buffers.size === 0) return
  const ids = [...buffers.keys()]
  const id = choice === 'random' ? ids[Math.floor(Math.random() * ids.length)] : choice
  const buffer = buffers.get(id)
  if (!buffer) return

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start()
}

export function useSlapDetector(sensitivity: Sensitivity, soundChoice: SoundChoice) {
  const [isListening, setIsListening] = useState(false)
  const [level, setLevel] = useState(0)
  const [slapCount, setSlapCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const armedRef = useRef(true)
  const lastSlapAtRef = useRef(0)
  const baselineRef = useRef(0)
  const soundBuffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const sensitivityRef = useRef<Sensitivity>(sensitivity)
  const soundChoiceRef = useRef<SoundChoice>(soundChoice)

  sensitivityRef.current = sensitivity
  soundChoiceRef.current = soundChoice

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const audioCtx = audioCtxRef.current
    if (!analyser || !audioCtx) return

    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)

    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const amplitude = Math.abs(data[i] - 128) / 128
      if (amplitude > peak) peak = amplitude
    }
    setLevel(peak)

    const threshold = Math.max(baselineRef.current + JUMP_BY_SENSITIVITY[sensitivityRef.current], MIN_ABS_PEAK)
    const now = performance.now()

    if (armedRef.current && peak > threshold && now - lastSlapAtRef.current > MIN_MS_BETWEEN_SLAPS) {
      lastSlapAtRef.current = now
      armedRef.current = false
      setSlapCount((c) => c + 1)
      playSlapSound(audioCtx, soundBuffersRef.current, soundChoiceRef.current)
    }

    if (!armedRef.current && peak < baselineRef.current + JUMP_BY_SENSITIVITY[sensitivityRef.current] * 0.3) {
      armedRef.current = true
    }

    if (armedRef.current) {
      baselineRef.current += (peak - baselineRef.current) * BASELINE_SMOOTHING
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    setIsListening(false)
    setLevel(0)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      source.connect(analyser)

      streamRef.current = stream
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      armedRef.current = true
      lastSlapAtRef.current = 0
      baselineRef.current = 0

      soundBuffersRef.current = await loadSlapSounds(audioCtx)

      setIsListening(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mikrofona erişilemedi')
    }
  }, [tick])

  useEffect(() => stop, [stop])

  return { isListening, level, slapCount, error, start, stop }
}
