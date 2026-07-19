/**
 * Percussion Mode play screen (SPEC §3.1) with the M2 juice pass
 * (addendum §B.2): every hit answers within 100ms in motion+sound, combo is
 * environment (background warmth), miss is brief desaturation, micro
 * hit-stop (≤30ms) on phrase-final notes, pooled ripples (≤60), reduced-
 * motion honored. Feedback lives in-world — no popups, no floating numbers
 * (CLAUDE.md §1.2).
 */
import { useEffect, useRef, useState } from 'react'
import {
  PercussionSession,
  type Lesson,
  type SessionSummary,
} from '../core/percussion'
import { LookaheadScheduler } from '../core/scheduler'
import { InputCapture } from '../core/input'
import { buildTapeScore, type TapeScore } from '../core/tape'
import { guideLevel as computeGuideLevel, type GuideLevel } from '../core/mastery'
import { createAudioEngine, type AudioEngine } from './audioEngine'
import { createMasterBus, playVoice } from './soundPack'
import { renderTape, type RenderedTape } from './tapeRender'
import {
  loadMastery,
  saveMastery,
  captureSession,
  loadGuideOverride,
} from './masteryStore'
import { computeSkillRing } from '../core/mastery'
import { SkillRing } from './SkillRing'

const W = 760
const H = 330
const INK = '#1a1a1a'
const PAPER = '#fafaf7'
const ACCENT = '#d85a30'
const MAX_RIPPLES = 60
const HIT_STOP_MS = 28

import type { VoiceId } from '../core/percussion'

type SchedEvent =
  | { type: 'call'; code: string; voice: VoiceId }
  | { type: 'layer'; voice: VoiceId }
  | { type: 'phrase-end'; phraseIndex: number }
  | { type: 'session-end' }

interface Ripple {
  active: boolean
  bornMs: number
  x: number
  y: number
  accent: boolean
}

interface VisualState {
  callFlashes: Map<string, number> // code → last flash ms
  hitMarks: { targetIndex: number; judgment: string }[]
  streak: number
  missFlashMs: number
  hitStopUntilMs: number
  ripples: Ripple[]
}

type Phase = 'ready' | 'playing' | 'ended'

export function PercussionScreen({
  lesson,
  onExit,
}: {
  lesson: Lesson
  onExit: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [tape, setTape] = useState<RenderedTape | null>(null)
  const [tapeUrl, setTapeUrl] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const busRef = useRef<AudioNode | null>(null)
  const schedulerRef = useRef<LookaheadScheduler<SchedEvent> | null>(null)
  const sessionRef = useRef<PercussionSession | null>(null)
  const captureRef = useRef(new InputCapture())
  const rafRef = useRef(0)
  const reducedMotion = useRef(
    typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const visRef = useRef<VisualState>({
    callFlashes: new Map(),
    hitMarks: [],
    streak: 0,
    missFlashMs: -1e9,
    hitStopUntilMs: -1e9,
    ripples: Array.from({ length: MAX_RIPPLES }, () => ({
      active: false,
      bornMs: 0,
      x: 0,
      y: 0,
      accent: false,
    })),
  })
  const guideRef = useRef<GuideLevel>(0)

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      schedulerRef.current?.stop()
      engineRef.current?.dispose()
      if (tapeUrl !== null) URL.revokeObjectURL(tapeUrl)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // --- keyboard input during play ---
  useEffect(() => {
    if (phase !== 'playing') return
    const onKeyDown = (e: KeyboardEvent) => {
      const tPerf = performance.now()
      if (e.code === 'Escape') {
        endSession()
        return
      }
      if (captureRef.current.keyDown(e, tPerf) === null) return
      const engine = engineRef.current
      const session = sessionRef.current
      const bus = busRef.current
      if (engine === null || session === null || bus === null) return
      e.preventDefault()

      const tAudio = engine.clock.perfToAudio(tPerf)
      const hit = session.recordHit(e.code, tAudio)
      const playAt = Math.max(engine.ctx.currentTime + 0.002, hit.renderTimeSec)
      playVoice(engine.ctx, bus, hit.voice ?? 'rim', playAt, hit.gain)

      // juice bookkeeping (visual state only — no popups)
      const vis = visRef.current
      const nowMs = performance.now()
      if (hit.kind === 'hit' && hit.targetIndex !== null) {
        vis.hitMarks.push({
          targetIndex: hit.targetIndex,
          judgment: hit.judgment ?? 'miss',
        })
        if (hit.judgment === 'perfect' || hit.judgment === 'good') {
          vis.streak += 1
        } else {
          vis.streak = 0
          vis.missFlashMs = nowMs
        }
        if (hit.phraseFinal && !reducedMotion.current) {
          vis.hitStopUntilMs = nowMs + HIT_STOP_MS
        }
      } else {
        vis.streak = 0
      }
      spawnRipple(vis, nowMs, hit.judgment === 'perfect')
    }
    const onKeyUp = (e: KeyboardEvent) => captureRef.current.keyUp(e)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function spawnRipple(vis: VisualState, nowMs: number, accent: boolean) {
    if (reducedMotion.current) return
    const slot = vis.ripples.find((r) => !r.active) ?? vis.ripples[0]!
    slot.active = true
    slot.bornMs = nowMs
    slot.x = W / 2
    slot.y = 78
    slot.accent = accent
  }

  function endSession() {
    const session = sessionRef.current
    const engine = engineRef.current
    if (session === null || engine === null) return
    schedulerRef.current?.stop()
    schedulerRef.current = null
    cancelAnimationFrame(rafRef.current)
    const s = session.finalize()
    setSummary(s)
    setPhase('ended')

    // mastery capture + persist
    const model = loadMastery()
    captureSession(model, session, s, Date.now())
    saveMastery(model)

    // tape build + offline render (completion ritual §1.5 — even on quit)
    const score: TapeScore = buildTapeScore(
      s,
      s.hits,
      session.callEvents,
      session.startSec,
      { bpm: lesson.bpm },
    )
    void renderTape(score).then((rendered) => {
      setTape(rendered)
      setTapeUrl(URL.createObjectURL(rendered.wavBlob))
      // quiet auto-play of the artifact
      playTapeBuffer(rendered)
    })
    engine.dispose()
    engineRef.current = null
  }

  function playTapeBuffer(rendered: RenderedTape) {
    const ctx = new AudioContext()
    const src = ctx.createBufferSource()
    src.buffer = rendered.audioBuffer
    src.connect(ctx.destination)
    src.onended = () => void ctx.close()
    src.start()
  }

  function start() {
    const engine = createAudioEngine()
    engineRef.current = engine
    const bus = createMasterBus(engine.ctx)
    busRef.current = bus

    // progressive guide level (manual override wins)
    const override = loadGuideOverride()
    const model = loadMastery()
    guideRef.current =
      override === 'auto'
        ? computeGuideLevel(model, lesson.keys.map((k) => k.code))
        : (Number(override) as GuideLevel)

    const startSec = engine.ctx.currentTime + 1.6
    const session = new PercussionSession(lesson, startSec)
    sessionRef.current = session

    const scheduler = new LookaheadScheduler<SchedEvent>(
      { now: () => engine.ctx.currentTime },
      (ev) => {
        const data = ev.data
        if (data.type === 'call') {
          playVoice(engine.ctx, bus, data.voice, ev.timeSec, 0.8)
          visRef.current.callFlashes.set(data.code, performance.now())
        } else if (data.type === 'layer') {
          playVoice(engine.ctx, bus, data.voice, ev.timeSec, 0.3)
        } else if (data.type === 'phrase-end') {
          scheduleLayers(data.phraseIndex)
        } else {
          endSession()
        }
      },
    )
    schedulerRef.current = scheduler

    const scheduleLayers = (endedPhrase: number) => {
      const next = endedPhrase + 1
      if (next >= lesson.phrases.length) return
      const layered = lesson.phrases
        .map((_, i) => i)
        .filter((i) => i <= endedPhrase && session.isLayered(i))
        .slice(-2) // cap the backing texture
      const nextSpan = session.phraseSpan(next)
      for (const li of layered) {
        const liSpan = session.phraseSpan(li)
        const offset = nextSpan.callStartSec - liSpan.callStartSec
        for (const c of session.callEvents.filter((c) => c.phraseIndex === li)) {
          scheduler.schedule(c.timeSec + offset, { type: 'layer', voice: c.voice })
        }
      }
    }

    for (const c of session.callEvents) {
      scheduler.schedule(c.timeSec, { type: 'call', code: c.code, voice: c.voice })
    }
    lesson.phrases.forEach((_, i) => {
      scheduler.schedule(session.phraseSpan(i).endSec, {
        type: 'phrase-end',
        phraseIndex: i,
      })
    })
    scheduler.schedule(session.endSec + 0.5, { type: 'session-end' })
    scheduler.start()

    setPhase('playing')
    rafRef.current = requestAnimationFrame(draw)

    function draw() {
      const canvas = canvasRef.current
      const vis = visRef.current
      if (canvas !== null && sessionRef.current !== null) {
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== W * dpr) {
          canvas.width = W * dpr
          canvas.height = H * dpr
        }
        const g = canvas.getContext('2d')!
        g.setTransform(dpr, 0, 0, dpr, 0, 0)

        const nowMs = performance.now()
        const frozen = nowMs < vis.hitStopUntilMs
        const now = engine.ctx.currentTime

        // paper + combo warmth (environmental combo display, §B.2)
        g.fillStyle = PAPER
        g.fillRect(0, 0, W, H)
        const warmth = Math.min(vis.streak * 0.006, 0.07)
        if (warmth > 0) {
          g.fillStyle = ACCENT
          g.globalAlpha = warmth
          g.fillRect(0, 0, W, H)
          g.globalAlpha = 1
        }

        drawPulse(g, session, now, vis, nowMs, frozen)
        drawPhrase(g, session, now, vis)
        drawKeyboard(g, lesson, vis, nowMs, guideRef.current)

        // miss desaturation: brief gray veil, never shake/red (§B.2)
        const sinceMiss = nowMs - vis.missFlashMs
        if (sinceMiss < 260) {
          g.fillStyle = '#888880'
          g.globalAlpha = 0.14 * (1 - sinceMiss / 260)
          g.fillRect(0, 0, W, H)
          g.globalAlpha = 1
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }
  }

  return (
    <section style={{ padding: '1.5rem 2rem' }}>
      <h2 style={{ fontSize: '1rem', letterSpacing: '0.1em' }}>
        {lesson.title}{' '}
        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>
          {lesson.subtitle} · {lesson.bpm} BPM
        </span>
      </h2>

      {phase === 'ready' && (
        <div style={{ margin: '1rem 0' }}>
          <p style={{ lineHeight: 1.6, marginBottom: '1rem' }}>
            리듬이 먼저 부르고(콜), 당신이 따라 칩니다(리스폰스). 불 들어오는
            키를 박자에 맞춰 누르세요. <kbd>Esc</kbd> 로 언제든 마쳐도 —
            테이프는 만들어집니다.
          </p>
          <button onClick={start} style={btn}>
            ▶ 시작
          </button>
          <button onClick={onExit} style={{ ...btn, marginLeft: 8 }}>
            ← 돌아가기
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H, display: 'block', marginTop: '1rem' }}
        />
      )}

      {phase === 'ended' && summary !== null && (
        <EndingScene
          summary={summary}
          tape={tape}
          tapeUrl={tapeUrl}
          onReplay={() => tape !== null && playTapeBuffer(tape)}
          onExit={onExit}
        />
      )}
    </section>
  )
}

/** Quiet completion ritual (SPEC §5): artifact first, stats fade in small. */
function EndingScene({
  summary,
  tape,
  tapeUrl,
  onReplay,
  onExit,
}: {
  summary: SessionSummary
  tape: RenderedTape | null
  tapeUrl: string | null
  onReplay: () => void
  onExit: () => void
}) {
  const [showStats, setShowStats] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShowStats(true), 1600)
    return () => clearTimeout(t)
  }, [])

  const model = loadMastery()
  const ring = computeSkillRing(model, model.trackedKeys())

  return (
    <div style={{ maxWidth: 560, margin: '2rem 0' }}>
      <p style={{ letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
        오늘의 테이프
      </p>
      <div
        style={{
          border: `1.5px solid ${INK}`,
          padding: '1.2rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <span style={{ color: ACCENT, fontSize: '1.4rem' }}>▮▮</span>
        <span style={{ opacity: 0.7 }}>
          {tape === null ? 'rendering…' : `${tape.durationSec.toFixed(1)}s tape`}
        </span>
        <button onClick={onReplay} style={btn} disabled={tape === null}>
          ▶ 다시 듣기
        </button>
        {tapeUrl !== null && (
          <a
            href={tapeUrl}
            download="tadak-session-tape.wav"
            style={{ ...btn, textDecoration: 'none', color: INK }}
          >
            ⬇ WAV
          </a>
        )}
      </div>

      <div
        style={{
          opacity: showStats ? 1 : 0,
          transition: 'opacity 1.2s ease',
          marginTop: '1.5rem',
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          fontSize: '0.85rem',
        }}
      >
        <SkillRing ring={ring} size={90} />
        <div style={{ lineHeight: 2 }}>
          <div>
            accuracy{' '}
            <strong style={{ color: ACCENT }}>
              {(summary.overallAccuracy * 100).toFixed(0)}%
            </strong>
          </div>
          <div>
            precision{' '}
            <strong>
              {summary.meanAbsErrorMs === null
                ? '—'
                : `${summary.meanAbsErrorMs.toFixed(0)}ms`}
            </strong>
          </div>
          <div>
            layered grooves <strong>{summary.layeredCount}</strong>
          </div>
        </div>
      </div>

      <button onClick={onExit} style={{ ...btn, marginTop: '1.5rem' }}>
        ← 선반으로
      </button>
    </div>
  )
}

// ---- canvas painters (no allocation-heavy work per frame) ----

function drawPulse(
  g: CanvasRenderingContext2D,
  session: PercussionSession,
  now: number,
  vis: VisualState,
  nowMs: number,
  frozen: boolean,
) {
  const beatPhase =
    ((now - session.startSec) / session.secPerBeat) % 1
  const pulse = frozen ? 0 : Math.max(0, 1 - beatPhase) * 5
  g.strokeStyle = INK
  g.lineWidth = 1.5
  g.beginPath()
  g.arc(W / 2, 78, 26 + pulse, 0, Math.PI * 2)
  g.stroke()

  for (const r of vis.ripples) {
    if (!r.active) continue
    const age = (nowMs - r.bornMs) / 500
    if (age >= 1) {
      r.active = false
      continue
    }
    g.strokeStyle = r.accent ? ACCENT : INK
    g.globalAlpha = 1 - age
    g.beginPath()
    g.arc(r.x, r.y, 26 + age * 46, 0, Math.PI * 2)
    g.stroke()
    g.globalAlpha = 1
  }
}

function drawPhrase(
  g: CanvasRenderingContext2D,
  session: PercussionSession,
  now: number,
  vis: VisualState,
) {
  // which phrase are we in?
  let pi = session.lesson.phrases.length - 1
  for (let i = 0; i < session.lesson.phrases.length; i++) {
    if (now < session.phraseSpan(i).endSec) {
      pi = i
      break
    }
  }
  const span = session.phraseSpan(pi)
  const phrase = session.lesson.phrases[pi]!
  const inCall = now < span.responseStartSec
  const x0 = 90
  const width = W - 180
  const y = 168

  // lane
  g.strokeStyle = INK
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(x0, y)
  g.lineTo(x0 + width, y)
  g.stroke()

  // progress cursor sweeping the half (call or response)
  const halfLen = span.responseStartSec - span.callStartSec
  const halfStart = inCall ? span.callStartSec : span.responseStartSec
  const prog = Math.min(Math.max((now - halfStart) / halfLen, 0), 1)
  g.strokeStyle = ACCENT
  g.beginPath()
  g.moveTo(x0 + width * prog, y - 14)
  g.lineTo(x0 + width * prog, y + 14)
  g.stroke()

  // pattern dots: outline in call (fill as they sound), player marks in response
  for (const step of phrase.steps) {
    const x = x0 + (step.beat / phrase.lengthBeats) * width
    g.strokeStyle = INK
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(x, y, 8, 0, Math.PI * 2)
    g.stroke()

    const stepCallTime = span.callStartSec + step.beat * session.secPerBeat
    if (now >= stepCallTime && inCall) {
      g.fillStyle = ACCENT
      g.beginPath()
      g.arc(x, y, 4, 0, Math.PI * 2)
      g.fill()
    }
  }
  if (!inCall) {
    for (const t of session.responseTargets) {
      if (t.phraseIndex !== pi) continue
      const mark = vis.hitMarks.find((m) => m.targetIndex === t.index)
      if (mark === undefined) continue
      const x =
        x0 +
        ((t.timeSec - span.responseStartSec) /
          (phrase.lengthBeats * session.secPerBeat)) *
          width
      g.fillStyle = mark.judgment === 'late' ? INK : ACCENT
      g.globalAlpha = mark.judgment === 'late' ? 0.45 : 1
      g.beginPath()
      g.arc(x, y, mark.judgment === 'perfect' ? 5.5 : 4.5, 0, Math.PI * 2)
      g.fill()
      g.globalAlpha = 1
    }
  }

  // call/response phase marker: a small line under the active half label area
  g.fillStyle = INK
  g.font = '11px ui-monospace, monospace'
  g.globalAlpha = 0.55
  g.fillText(inCall ? 'listen' : 'play', x0, y - 24)
  g.globalAlpha = 1
}

const KEY_ROWS: string[][] = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
]
const KEY_LABEL: Record<string, string> = { Semicolon: ';' }

function drawKeyboard(
  g: CanvasRenderingContext2D,
  lesson: Lesson,
  vis: VisualState,
  nowMs: number,
  level: GuideLevel,
) {
  const kw = 44
  const kh = 26
  const gap = 6
  const y0 = 224
  const lessonKeys = new Set(lesson.keys.map((k) => k.code))

  KEY_ROWS.forEach((row, ri) => {
    const rowW = row.length * (kw + gap) - gap
    const x0 = (W - rowW) / 2 + ri * 12
    row.forEach((code, ci) => {
      const x = x0 + ci * (kw + gap)
      const y = y0 + ri * (kh + gap)
      const inLesson = lessonKeys.has(code)
      if (level === 2 && !inLesson) return
      if (level >= 1 && !inLesson) return // level 1: lesson keys only

      // finger-zone tint (level 0 only): alternating soft columns
      if (level === 0) {
        const zone = Math.min(ci, row.length - 1 - ci) // symmetric zones
        g.fillStyle = ACCENT
        g.globalAlpha = 0.025 + (zone % 2) * 0.02
        g.fillRect(x, y, kw, kh)
        g.globalAlpha = 1
      }

      // call flash: key lights when its voice sounds
      const flash = vis.callFlashes.get(code)
      const lit = flash !== undefined && nowMs - flash < 220
      if (level === 2) {
        // minimal: tick marks only
        g.strokeStyle = lit ? ACCENT : INK
        g.beginPath()
        g.moveTo(x + kw / 2, y + kh - 4)
        g.lineTo(x + kw / 2, y + kh)
        g.stroke()
        return
      }
      g.strokeStyle = inLesson ? (lit ? ACCENT : INK) : INK
      g.globalAlpha = inLesson ? 1 : 0.25
      g.lineWidth = inLesson ? 1.5 : 1
      if (lit) {
        g.fillStyle = ACCENT
        g.globalAlpha = 0.85
        g.fillRect(x, y, kw, kh)
        g.globalAlpha = 1
      }
      g.strokeRect(x, y, kw, kh)
      if (inLesson || level === 0) {
        g.fillStyle = lit ? PAPER : INK
        g.font = '11px ui-monospace, monospace'
        g.globalAlpha = inLesson ? 1 : 0.35
        const label = KEY_LABEL[code] ?? code.replace('Key', '')
        g.fillText(label, x + kw / 2 - 3, y + kh / 2 + 4)
      }
      g.globalAlpha = 1
    })
  })
}

const btn: React.CSSProperties = {
  font: 'inherit',
  padding: '0.5rem 1rem',
  background: 'transparent',
  color: INK,
  border: `1.5px solid ${INK}`,
  cursor: 'pointer',
}
