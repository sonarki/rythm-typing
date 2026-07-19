/**
 * ASC v1 calibration screen (HANDOFF-BRIEF §3.6).
 * Plays a click at 60 BPM; the player taps Space along with it ×16; the
 * median tap error becomes the stored per-device calibration offset
 * (localStorage) and is fed into the clock. Mic-assisted mode is M5 — not here.
 */
import { useEffect, useRef, useState } from 'react'
import { computeMedianOffsetMs } from '../core/clock'
import { InputCapture } from '../core/input'
import {
  createAudioEngine,
  saveCalibrationOffsetMs,
  loadCalibrationOffsetMs,
  type AudioEngine,
} from './audioEngine'

const TAPS_NEEDED = 16
const CLICK_PERIOD_SEC = 1 // 60 BPM

type Phase = 'idle' | 'running' | 'done'

export function CalibrationScreen() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [tapCount, setTapCount] = useState(0)
  const [storedOffset, setStoredOffset] = useState(loadCalibrationOffsetMs())
  const [resultOffset, setResultOffset] = useState<number | null>(null)

  const engineRef = useRef<AudioEngine | null>(null)
  const clickTimesRef = useRef<number[]>([])
  const samplesRef = useRef<number[]>([])
  const captureRef = useRef(new InputCapture())

  useEffect(() => () => engineRef.current?.dispose(), [])

  useEffect(() => {
    if (phase !== 'running') return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const tPerf = performance.now()
      const entry = captureRef.current.keyDown(e, tPerf)
      if (entry === null) return
      const engine = engineRef.current
      if (engine === null) return

      // Convert with offset 0 during measurement: we are MEASURING the offset.
      engine.clock.setCalibrationOffsetMs(0)
      const tAudio = engine.clock.perfToAudio(tPerf)
      const past = clickTimesRef.current.filter((t) => t <= tAudio + CLICK_PERIOD_SEC / 2)
      if (past.length === 0) return
      const nearest = past.reduce((a, b) =>
        Math.abs(b - tAudio) < Math.abs(a - tAudio) ? b : a,
      )
      samplesRef.current.push((tAudio - nearest) * 1000)
      const n = samplesRef.current.length
      setTapCount(n)

      if (n >= TAPS_NEEDED) {
        const offset = computeMedianOffsetMs(samplesRef.current)
        saveCalibrationOffsetMs(offset)
        engine.clock.setCalibrationOffsetMs(offset)
        setStoredOffset(offset)
        setResultOffset(offset)
        setPhase('done')
        engine.dispose()
        engineRef.current = null
      }
    }
    const onKeyUp = (e: KeyboardEvent) => captureRef.current.keyUp(e)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [phase])

  const start = () => {
    clickTimesRef.current = []
    samplesRef.current = []
    setTapCount(0)
    setResultOffset(null)

    const engine = createAudioEngine()
    engineRef.current = engine
    const scheduler = engine.makeScheduler((t) => engine.click(t))
    const t0 = engine.ctx.currentTime + 1
    for (let i = 0; i < TAPS_NEEDED + 8; i++) {
      const t = t0 + i * CLICK_PERIOD_SEC
      clickTimesRef.current.push(t)
      scheduler.schedule(t, t)
    }
    scheduler.start()
    setPhase('running')
  }

  return (
    <section style={{ padding: '2rem', maxWidth: 560 }}>
      <h2 style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>
        CALIBRATION — ASC v1
      </h2>
      <p style={{ margin: '1rem 0', lineHeight: 1.6 }}>
        Tap <kbd>Space</kbd> together with the click, {TAPS_NEEDED} times. The
        median offset is stored on this device and feeds every timing
        conversion.
      </p>

      {phase === 'idle' && (
        <button onClick={start} style={buttonStyle}>
          ▶ start clicks (60 BPM)
        </button>
      )}

      {phase === 'running' && (
        <div aria-live="polite">
          <div style={{ display: 'flex', gap: 6, margin: '1rem 0' }}>
            {Array.from({ length: TAPS_NEEDED }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1.5px solid var(--ink)',
                  background: i < tapCount ? 'var(--accent)' : 'transparent',
                  borderColor: i < tapCount ? 'var(--accent)' : 'var(--ink)',
                }}
              />
            ))}
          </div>
          <p>
            {tapCount} / {TAPS_NEEDED}
          </p>
        </div>
      )}

      {phase === 'done' && resultOffset !== null && (
        <div>
          <p style={{ margin: '1rem 0' }}>
            offset stored:{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {resultOffset.toFixed(1)} ms
            </strong>
          </p>
          <button onClick={start} style={buttonStyle}>
            ↻ recalibrate
          </button>
        </div>
      )}

      <p style={{ marginTop: '2rem', opacity: 0.6, fontSize: '0.8rem' }}>
        current stored offset: {storedOffset.toFixed(1)} ms
      </p>
    </section>
  )
}

const buttonStyle: React.CSSProperties = {
  font: 'inherit',
  padding: '0.6rem 1.2rem',
  background: 'transparent',
  color: 'var(--ink)',
  border: '1.5px solid var(--ink)',
  cursor: 'pointer',
}
