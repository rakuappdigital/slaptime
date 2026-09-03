import { useCallback, useEffect, useRef, useState } from 'react'

export type Sensitivity = 'low' | 'medium' | 'high'

const FFT_SIZE = 1024
const SILENCE_LEVEL = 0.08
const REARM_LEVEL = 0.05
const MIN_MS_BETWEEN_SLAPS = 250

const THRESHOLD_BY_SENSITIVITY: Record<Sensitivity, number> = {
  low: SILENCE_LEVEL + 0.45,
  medium: SILENCE_LEVEL + 0.25,
  high: SILENCE_LEVEL + 0.08,
}

function playSlapSound(ctx: AudioContext) {
  const duration = 0.15
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1200
  bandpass.Q.value = 0.6

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(1, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  noise.connect(bandpass).connect(gain).connect(ctx.destination)
  noise.start()
  noise.stop(ctx.currentTime + duration)
}

export function useSlapDetector(sensitivity: Sensitivity) {
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
  const sensitivityRef = useRef<Sensitivity>(sensitivity)

  sensitivityRef.current = sensitivity

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

    const threshold = THRESHOLD_BY_SENSITIVITY[sensitivityRef.current]
    const now = performance.now()

    if (armedRef.current && peak > threshold && now - lastSlapAtRef.current > MIN_MS_BETWEEN_SLAPS) {
      lastSlapAtRef.current = now
      armedRef.current = false
      setSlapCount((c) => c + 1)
      playSlapSound(audioCtx)
    }

    if (!armedRef.current && peak < REARM_LEVEL) {
      armedRef.current = true
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

      setIsListening(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mikrofona erişilemedi')
    }
  }, [tick])

  useEffect(() => stop, [stop])

  return { isListening, level, slapCount, error, start, stop }
}
