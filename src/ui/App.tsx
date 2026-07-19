import { useState } from 'react'
import { CalibrationScreen } from './CalibrationScreen'
import { DebugLane } from '../dev/DebugLane'
import { PercussionScreen } from './PercussionScreen'
import { SkillRing } from './SkillRing'
import { LESSONS, type Lesson } from '../core/percussion'
import { computeSkillRing } from '../core/mastery'
import {
  loadMastery,
  loadGuideOverride,
  saveGuideOverride,
  type GuideOverride,
} from './masteryStore'

type Screen = 'home' | 'percussion' | 'calibration' | 'lane'

export function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [guideOverride, setGuideOverride] = useState<GuideOverride>(
    loadGuideOverride(),
  )

  const openLesson = (l: Lesson) => {
    setLesson(l)
    setScreen('percussion')
  }

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
        <h1
          style={{ fontSize: '1.1rem', letterSpacing: '0.2em', cursor: 'pointer' }}
          onClick={() => setScreen('home')}
        >
          TADAK <span style={{ color: 'var(--accent)' }}>·</span> M2
        </h1>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          {(['home', 'calibration', 'lane'] as const).map((s) => (
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
        <label style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.7 }}>
          guide{' '}
          <select
            value={guideOverride}
            onChange={(e) => {
              const v = e.target.value as GuideOverride
              setGuideOverride(v)
              saveGuideOverride(v)
            }}
            style={{ font: 'inherit' }}
          >
            <option value="auto">auto</option>
            <option value="0">full</option>
            <option value="1">outline</option>
            <option value="2">minimal</option>
          </select>
        </label>
      </header>

      {screen === 'home' && <Home onOpen={openLesson} />}
      {screen === 'percussion' && lesson !== null && (
        <PercussionScreen lesson={lesson} onExit={() => setScreen('home')} />
      )}
      {screen === 'calibration' && <CalibrationScreen />}
      {screen === 'lane' && <DebugLane />}
    </main>
  )
}

/** The studio shelf, v0: lessons + the skill ring. Quiet, line-art, coral. */
function Home({ onOpen }: { onOpen: (l: Lesson) => void }) {
  const model = loadMastery()
  const tracked = model.trackedKeys()
  const ring = computeSkillRing(model, tracked.length > 0 ? tracked : ['—'])

  return (
    <section style={{ padding: '2rem', display: 'flex', gap: '3rem' }}>
      <div>
        <p style={{ letterSpacing: '0.15em', marginBottom: '1rem' }}>
          PERCUSSION — 오늘의 드릴
        </p>
        <div style={{ display: 'grid', gap: '0.8rem', maxWidth: 420 }}>
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              onClick={() => onOpen(l)}
              style={{
                font: 'inherit',
                textAlign: 'left',
                padding: '0.9rem 1.1rem',
                background: 'transparent',
                border: '1.5px solid var(--ink)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: '1rem',
              }}
            >
              <span>
                <span style={{ color: 'var(--accent)', marginRight: 8 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {l.title}
                <span style={{ opacity: 0.5, marginLeft: 8, fontSize: '0.8rem' }}>
                  {l.subtitle}
                </span>
              </span>
              <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{l.bpm} BPM</span>
            </button>
          ))}
        </div>
        <p style={{ marginTop: '1.2rem', fontSize: '0.8rem', opacity: 0.55 }}>
          처음이라면 01부터 — 4개의 키만으로 완주하는 첫 곡입니다. 시작 전{' '}
          calibration 탭에서 16탭 보정을 한 번 해두면 판정이 정확해집니다.
        </p>
      </div>
      <div>
        <p style={{ letterSpacing: '0.15em', marginBottom: '1rem' }}>SKILL RING</p>
        <SkillRing ring={ring} />
        <p style={{ fontSize: '0.75rem', opacity: 0.55, maxWidth: 160, marginTop: 8 }}>
          두께 = 익힌 키, 조임 = 리듬 정밀도. 몇 주에 걸쳐 조여듭니다.
        </p>
      </div>
    </section>
  )
}
