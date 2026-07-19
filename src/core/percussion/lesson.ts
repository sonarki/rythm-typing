/**
 * Percussion Mode lesson data (SPEC §3.1). Pure data — the session machine
 * interprets it. Difficulty ramp per spec: BPM 60→120, one row → cross-row.
 *
 * Voices are abstract ids; the UI sound pack decides how each id sounds.
 * `snapWindowMs` is the Grace Clock v1 dial per lesson (addendum §A.3 novice
 * floor): lesson 1 is FULL snap (window ≥ the 8th-note interval, everything
 * lands in the pocket — the §A.4 first-day promise), tightening after.
 */

export type VoiceId = 'kick' | 'snare' | 'hat' | 'rim'

/** One key the lesson uses, bound to a voice. */
export interface KeyVoice {
  code: string
  voice: VoiceId
}

/** One step of a call pattern: beat offset within the phrase + which key. */
export interface PatternStep {
  /** Beats from phrase start (8th-note resolution: .0 / .5). */
  beat: number
  code: string
}

/** A call-and-response phrase: the call plays `steps`, the player echoes. */
export interface Phrase {
  steps: PatternStep[]
  /** Length of the call (and of the response) in beats. */
  lengthBeats: number
}

export interface Lesson {
  id: string
  title: string
  subtitle: string
  bpm: number
  keys: KeyVoice[]
  phrases: Phrase[]
  /** Grace Clock v1 render-snap window for this lesson, ms. */
  snapWindowMs: number
}

const P = (lengthBeats: number, ...steps: [number, string][]): Phrase => ({
  lengthBeats,
  steps: steps.map(([beat, code]) => ({ beat, code })),
})

/**
 * Lesson 1 — the first-day onboarding song (addendum §A.4): four keys,
 * slow, quarter-note calls, FULL grace snap (interval at 72 BPM ≈ 417ms per
 * 8th; window 999 ⇒ every hit renders in the pocket). Success before
 * teaching.
 */
const FIRST_GROOVE: Lesson = {
  id: 'first-groove',
  title: '첫 그루브',
  subtitle: 'four keys, one pocket',
  bpm: 72,
  keys: [
    { code: 'KeyD', voice: 'hat' },
    { code: 'KeyF', voice: 'kick' },
    { code: 'KeyJ', voice: 'snare' },
    { code: 'KeyK', voice: 'rim' },
  ],
  phrases: [
    P(4, [0, 'KeyF'], [2, 'KeyJ']),
    P(4, [0, 'KeyF'], [1, 'KeyF'], [2, 'KeyJ']),
    P(4, [0, 'KeyF'], [1.5, 'KeyD'], [2, 'KeyJ'], [3, 'KeyD']),
    P(4, [0, 'KeyF'], [1, 'KeyK'], [2, 'KeyJ'], [3, 'KeyK']),
    P(4, [0, 'KeyF'], [1.5, 'KeyD'], [2, 'KeyJ'], [3.5, 'KeyK']),
  ],
  snapWindowMs: 999,
}

/** Lesson 2 — home row, 8th-note figures, novice snap (±70ms). */
const HOME_ROW_SHUFFLE: Lesson = {
  id: 'home-row-shuffle',
  title: '홈로우 셔플',
  subtitle: 'eight fingers wake up',
  bpm: 88,
  keys: [
    { code: 'KeyA', voice: 'kick' },
    { code: 'KeyS', voice: 'hat' },
    { code: 'KeyD', voice: 'hat' },
    { code: 'KeyF', voice: 'kick' },
    { code: 'KeyJ', voice: 'snare' },
    { code: 'KeyK', voice: 'rim' },
    { code: 'KeyL', voice: 'hat' },
    { code: 'Semicolon', voice: 'rim' },
  ],
  phrases: [
    P(4, [0, 'KeyF'], [1, 'KeyJ'], [2, 'KeyF'], [3, 'KeyJ']),
    P(4, [0, 'KeyA'], [1, 'KeyJ'], [2, 'KeyF'], [2.5, 'KeyF'], [3, 'KeyJ']),
    P(4, [0, 'KeyF'], [0.5, 'KeyD'], [1, 'KeyJ'], [2, 'KeyF'], [2.5, 'KeyS'], [3, 'KeyJ']),
    P(4, [0, 'KeyA'], [1, 'KeyK'], [1.5, 'KeyL'], [2, 'KeyF'], [3, 'KeyJ'], [3.5, 'Semicolon']),
    P(4, [0, 'KeyF'], [0.5, 'KeyD'], [1, 'KeyJ'], [1.5, 'KeyK'], [2, 'KeyA'], [2.5, 'KeyS'], [3, 'KeyJ'], [3.5, 'KeyL']),
  ],
  snapWindowMs: 140,
}

/** Lesson 3 — cross-row syncopation, tighter snap (±40ms). */
const CROSS_ROW_BREAK: Lesson = {
  id: 'cross-row-break',
  title: '크로스로우 브레이크',
  subtitle: 'rows talk to each other',
  bpm: 104,
  keys: [
    { code: 'KeyF', voice: 'kick' },
    { code: 'KeyJ', voice: 'snare' },
    { code: 'KeyR', voice: 'hat' },
    { code: 'KeyU', voice: 'hat' },
    { code: 'KeyV', voice: 'rim' },
    { code: 'KeyN', voice: 'rim' },
  ],
  phrases: [
    P(4, [0, 'KeyF'], [1, 'KeyJ'], [2.5, 'KeyF'], [3, 'KeyJ']),
    P(4, [0, 'KeyF'], [0.5, 'KeyR'], [1, 'KeyJ'], [2, 'KeyF'], [2.5, 'KeyU'], [3, 'KeyJ']),
    P(4, [0, 'KeyF'], [1, 'KeyJ'], [1.5, 'KeyV'], [2.5, 'KeyF'], [3, 'KeyJ'], [3.5, 'KeyN']),
    P(4, [0, 'KeyF'], [0.5, 'KeyR'], [1, 'KeyJ'], [1.5, 'KeyU'], [2, 'KeyV'], [2.5, 'KeyF'], [3, 'KeyJ'], [3.5, 'KeyN']),
  ],
  snapWindowMs: 80,
}

export const LESSONS: readonly Lesson[] = [
  FIRST_GROOVE,
  HOME_ROW_SHUFFLE,
  CROSS_ROW_BREAK,
]

export function voiceForKey(lesson: Lesson, code: string): VoiceId | null {
  return lesson.keys.find((k) => k.code === code)?.voice ?? null
}
