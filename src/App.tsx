import { useState } from 'react'
import './App.css'
import logo from './assets/slap-logo.jpg'
import { useSlapDetector, type Sensitivity } from './useSlapDetector'

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string }[] = [
  { value: 'low', label: 'Düşük' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
]

function App() {
  const [sensitivity, setSensitivity] = useState<Sensitivity>('medium')
  const { isListening, level, slapCount, error, start, stop } = useSlapDetector(sensitivity)

  return (
    <div className="app" data-hit={level > 0.4}>
      <div className="glow" style={{ opacity: Math.min(level * 1.4, 1) }} />

      <img className="logo" src={logo} alt="SlapTime" />

      <header className="brand">
        <span className="brand-mark">SLAP</span>
        <span className="brand-mark brand-mark--accent">TIME</span>
      </header>
      <p className="subtitle">cihaza vur, ses tetiklensin</p>

      <div className="ring-wrap">
        <div className="ring" style={{ transform: `scale(${1 + level * 0.35})`, opacity: 0.35 + level * 0.65 }} />
        <button className="listen-btn" onClick={isListening ? stop : start}>
          {isListening ? 'DURDUR' : 'BAŞLAT'}
        </button>
      </div>

      <div className="meter">
        <div className="meter-fill" style={{ width: `${Math.min(level * 100, 100)}%` }} />
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
