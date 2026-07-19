/**
 * DebugLane (HANDOFF-BRIEF §3.8): one canvas lane showing scheduled beats
 * sweeping toward a judgment line. Space on the beat → a hit marker whose
 * fill reflects the (honest) judgment. Monochrome line-art + the one accent;
 * judgment is conveyed in-world as marks on the lane, not popups.
 */
import { useEffect, useRef, useState } from 'react'
import { judgeDelta, type Judgment } from '../core/judge'
import { InputCapture } from '../core/input'
import { createAudioEngine, type AudioEngine } from '../ui/audioEngine'

const BPM = 90
const BEAT_SEC = 60 / BPM
const BEAT_COUNT = 64
const APPROACH_SEC = 2 // a beat travels the lane in 2s
const LANE_W = 720
const LANE_H = 140
const JUDGE_X = 120

interface HitMark {
  timeSec: number
  deltaSec: number
  judgment: Judgment
}

export function DebugLane() {
  const [running, setRunning] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const beatsRef = useRef<number[]>([])
  const hitsRef = useRef<HitMark[]>([])
  const captureRef = useRef(new InputCapture())
  const rafRef = useRef(0)

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      engineRef.current?.dispose()
    },
    [],
  )

  useEffect(() => {
    if (!running) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const tPerf = performance.now()
      if (captureRef.current.keyDown(e, tPerf) === null) return
      const engine = engineRef.current
      if (engine === null) return
      const tAudio = engine.clock.perfToAudio(tPerf) // honest judgeTime input
      const nearest = beatsRef.current.reduce(
        (a, b) => (Math.abs(b - tAudio) < Math.abs(a - tAudio) ? b : a),
        Number.POSITIVE_INFINITY,
      )
      const delta = tAudio - nearest
      hitsRef.current.push({
        timeSec: tAudio,
        deltaSec: delta,
        judgment: judgeDelta(delta),
      })
    }
    const onKeyUp = (e: KeyboardEvent) => captureRef.current.keyUp(e)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [running])

  const start = () => {
    const engine = createAudioEngine()
    engineRef.current = engine
    const scheduler = engine.makeScheduler((t) => engine.click(t))
    const t0 = engine.ctx.currentTime + 1
    beatsRef.current = []
    hitsRef.current = []
    for (let i = 0; i < BEAT_COUNT; i++) {
      const t = t0 + i * BEAT_SEC
      beatsRef.current.push(t)
      scheduler.schedule(t, t)
    }
    scheduler.start()
    setRunning(true)

    const draw = () => {
      const canvas = canvasRef.current
      if (canvas !== null) {
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== LANE_W * dpr) {
          canvas.width = LANE_W * dpr
          canvas.height = LANE_H * dpr
        }
        const g = canvas.getContext('2d')!
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, LANE_W, LANE_H)
        const ink = '#1a1a1a'
        const accent = '#d85a30'
        const now = engine.ctx.currentTime
        const pxPerSec = (LANE_W - JUDGE_X) / APPROACH_SEC

        // lane + judgment line
        g.strokeStyle = ink
        g.lineWidth = 1.5
        g.strokeRect(0.75, 0.75, LANE_W - 1.5, LANE_H - 1.5)
        g.beginPath()
        g.moveTo(JUDGE_X, 10)
        g.lineTo(JUDGE_X, LANE_H - 10)
        g.stroke()

        // beats flow right → left, crossing the line exactly on time
        for (const t of beatsRef.current) {
          const x = JUDGE_X + (t - now) * pxPerSec
          if (x < -20 || x > LANE_W + 20) continue
          g.beginPath()
          g.arc(x, LANE_H / 2, 9, 0, Math.PI * 2)
          g.stroke()
        }

        // hit marks pinned where the beat was met (offset = timing error)
        for (const h of hitsRef.current) {
          const beatT = h.timeSec - h.deltaSec
          const x = JUDGE_X + (beatT - now) * pxPerSec + h.deltaSec * pxPerSec
          if (x < -20 || x > LANE_W + 20) continue
          const r = h.judgment === 'perfect' ? 5 : h.judgment === 'good' ? 4 : 3
          g.fillStyle = h.judgment === 'miss' ? ink : accent
          g.globalAlpha = h.judgment === 'late' ? 0.5 : 1
          g.beginPath()
          g.arc(x, LANE_H / 2, r, 0, Math.PI * 2)
          g.fill()
          g.globalAlpha = 1
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
  }

  return (
    <section style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>
        DEBUG LANE — {BPM} BPM
      </h2>
      <p style={{ margin: '1rem 0', lineHeight: 1.6 }}>
        Beats sweep toward the line; tap <kbd>Space</kbd> as each circle
        crosses it. Filled coral = on time, faded = late, dark = miss.
      </p>
      {!running && (
        <button
          onClick={start}
          style={{
            font: 'inherit',
            padding: '0.6rem 1.2rem',
            background: 'transparent',
            border: '1.5px solid #1a1a1a',
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          ▶ start lane
        </button>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: LANE_W, height: LANE_H, display: 'block' }}
      />
    </section>
  )
}
