import { useState } from 'react'
import './App.css'
import logo from './assets/slap-logo.png'
import { SOUND_OPTIONS, useSlapDetector, type Sensitivity, type SoundChoice } from './useSlapDetector'

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string }[] = [
  { value: 'low', label: 'Düşük' },
  { value: 'high', label: 'Yüksek' },
]

const METER_SCALE = 3.2

function App() {
  const [sensitivity, setSensitivity] = useState<Sensitivity>('low')
  const [soundChoice, setSoundChoice] = useState<SoundChoice>('random')
  const { isListening, level, slapCount, error, start, stop } = useSlapDetector(sensitivity, soundChoice)
  const meterLevel = Math.min(level * METER_SCALE, 1)

  return (
    <div className="app" data-hit={meterLevel > 0.5}>
      <div className="glow" style={{ opacity: Math.min(meterLevel * 1.4, 1) }} />

      <header className="brand">
        <span className="brand-mark">SLAP</span>
        <span className="brand-mark brand-mark--accent">TIME</span>
        <img className="logo" src={logo} alt="SlapTime" />
      </header>
      <p className="subtitle">CİHAZI TOKATLA; EVET, TOKATLA!</p>

      <div className="ring-wrap">
        <div className="ring" style={{ transform: `scale(${1 + meterLevel * 0.35})`, opacity: 0.35 + meterLevel * 0.65 }} />
        <button className="listen-btn" onClick={isListening ? stop : start}>
          {isListening ? 'DURDUR' : 'BAŞLAT'}
        </button>
      </div>

      <div className="meter">
        <div className="meter-fill" style={{ width: `${meterLevel * 100}%` }} />
      </div>

      <div className="controls">
        <span className="controls-label">Hassasiyet</span>
        <div className="segmented">
          {SENSITIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="segmented-btn"
              data-active={sensitivity === opt.value}
              onClick={() => setSensitivity(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="controls">
        <span className="controls-label">Ses</span>
        <select
          className="sound-select"
          value={soundChoice}
          onChange={(e) => setSoundChoice(e.target.value)}
        >
          <option value="random">Karışık (Random)</option>
          {SOUND_OPTIONS.map((sound) => (
            <option key={sound.id} value={sound.id}>
              {sound.label}
            </option>
          ))}
        </select>
      </div>

      <div className="stats">
        <span className="status" data-active={isListening}>
          {isListening ? '● DİNLENİYOR' : '○ BEKLEMEDE'}
        </span>
        <span className="count">{slapCount}</span>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default App
