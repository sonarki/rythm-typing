import { useState } from 'react'
import { CalibrationScreen } from './CalibrationScreen'
import { DebugLane } from '../dev/DebugLane'

type Screen = 'calibration' | 'lane'

export function App() {
  const [screen, setScreen] = useState<Screen>('calibration')

  return (
    <main>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '1.5rem',
          padding: '1.5rem 2rem 0',
        }}
      >
        <h1 style={{ fontSize: '1.1rem', letterSpacing: '0.2em' }}>
          TADAK <span style={{ color: 'var(--accent)' }}>·</span> M0
        </h1>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          {(['calibration', 'lane'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScreen(s)}
              style={{
                font: 'inherit',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                borderBottom:
                  screen === s
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
              }}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>
      {screen === 'calibration' ? <CalibrationScreen /> : <DebugLane />}
    </main>
  )
}
