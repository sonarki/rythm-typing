/**
 * Percussion call-and-response session state machine (SPEC §3.1).
 *
 * Pure TypeScript, no timers, no audio — time flows in through method
 * arguments (audio-timeline seconds), events flow out as data. The UI feeds
 * it converted key hits and schedules the sounds/visuals it derives.
 *
 * Grace Clock v1 wiring happens HERE, at the engine boundary:
 * - judgment consumes the honest `judgeTime` (CLAUDE.md §1.4);
 * - every hit also carries `renderTimeSec` = `renderTime()` snapped to the
 *   lesson's 8th-note grid with the lesson's `snapWindowMs` — the time the
 *   UI must schedule the SOUND at. Stray hits (no matching target) still get
 *   a render time and a soft gain: nothing the player does sounds bad
 *   (CLAUDE.md §1.1) — a stray is quieter, never ugly.
 *
 * Layering (the growing groove): a phrase answered at ≥ LAYER_THRESHOLD
 * accuracy becomes part of the backing loop for the rest of the session.
 *
 * Determinism: same lesson + same (code, tAudioSec) hit sequence → identical
 * judgments, render times, layering, and summary (CLAUDE.md §2).
 */
import { renderTime, judgeTime, type SubdivisionGrid } from '../clock'
import { judgeDelta, DEFAULT_WINDOWS, type Judgment, type JudgeWindow } from '../judge'
import { voiceForKey, type Lesson, type VoiceId } from './lesson'

/** Accuracy needed for a phrase to join the backing groove. */
export const LAYER_THRESHOLD = 0.7

/** Gains per judgment — kindness rendered, honesty preserved. */
export const HIT_GAIN: Readonly<Record<Judgment | 'stray', number>> = {
  perfect: 1,
  good: 0.85,
  late: 0.6,
  miss: 0.45,
  stray: 0.4,
}

export interface CallEvent {
  timeSec: number
  code: string
  voice: VoiceId
  phraseIndex: number
  /** True for the last call event of a phrase. */
  phraseFinal: boolean
}

export interface ResponseTarget {
  index: number
  timeSec: number
  code: string
  voice: VoiceId
  phraseIndex: number
  /** True for the last target of a phrase (juice: micro hit-stop point). */
  phraseFinal: boolean
}

export interface HitResult {
  kind: 'hit' | 'stray'
  code: string
  voice: VoiceId | null
  /** Honest input time (judgment clock). */
  judgeTimeSec: number
  /** Grace-snapped time to schedule the audible result at. */
  renderTimeSec: number
  gain: number
  judgment: Judgment | null
  deltaSec: number | null
  targetIndex: number | null
  phraseFinal: boolean
}

export interface PhraseResult {
  phraseIndex: number
  judged: Judgment[]
  accuracy: number
  layered: boolean
}

export interface SessionSummary {
  lessonId: string
  phrases: PhraseResult[]
  /** All hits in input order (SPEC §4.5 log, judgment attached). */
  hits: HitResult[]
  overallAccuracy: number
  /** Mean absolute timing error over judged hits, ms; null if none. */
  meanAbsErrorMs: number | null
  layeredCount: number
}

export class PercussionSession {
  readonly callEvents: CallEvent[]
  readonly responseTargets: ResponseTarget[]
  readonly endSec: number
  readonly secPerBeat: number

  private grid: SubdivisionGrid
  private consumed: Set<number> = new Set()
  private hits: HitResult[] = []
  private windows: readonly JudgeWindow[]

  constructor(
    readonly lesson: Lesson,
    readonly startSec: number,
    windows: readonly JudgeWindow[] = DEFAULT_WINDOWS,
  ) {
    this.windows = windows
    this.secPerBeat = 60 / lesson.bpm
    // 8th-note render grid anchored at session start (Grace Clock v1).
    this.grid = { originSec: startSec, intervalSec: this.secPerBeat / 2 }

    const calls: CallEvent[] = []
    const targets: ResponseTarget[] = []
    let cursor = startSec
    lesson.phrases.forEach((phrase, phraseIndex) => {
      const callStart = cursor
      const responseStart = callStart + phrase.lengthBeats * this.secPerBeat
      phrase.steps.forEach((step, si) => {
        const phraseFinal = si === phrase.steps.length - 1
        calls.push({
          timeSec: callStart + step.beat * this.secPerBeat,
          code: step.code,
          voice: voiceForKey(lesson, step.code) ?? 'rim',
          phraseIndex,
          phraseFinal,
        })
        targets.push({
          index: targets.length,
          timeSec: responseStart + step.beat * this.secPerBeat,
          code: step.code,
          voice: voiceForKey(lesson, step.code) ?? 'rim',
          phraseIndex,
          phraseFinal,
        })
      })
      cursor = responseStart + phrase.lengthBeats * this.secPerBeat
    })
    this.callEvents = calls
    this.responseTargets = targets
    this.endSec = cursor
  }

  /** Phrase timing: [callStart, responseStart, end] in audio seconds. */
  phraseSpan(phraseIndex: number): {
    callStartSec: number
    responseStartSec: number
    endSec: number
  } {
    let cursor = this.startSec
    for (let i = 0; i < phraseIndex; i++) {
      cursor += this.lesson.phrases[i]!.lengthBeats * 2 * this.secPerBeat
    }
    const phrase = this.lesson.phrases[phraseIndex]!
    const responseStartSec = cursor + phrase.lengthBeats * this.secPerBeat
    return {
      callStartSec: cursor,
      responseStartSec,
      endSec: responseStartSec + phrase.lengthBeats * this.secPerBeat,
    }
  }

  /**
   * Record a player hit at honest audio time `tAudioSec`.
   * Matches the nearest unconsumed same-key target within the widest window.
   */
  recordHit(code: string, tAudioSec: number): HitResult {
    const tJudge = judgeTime(tAudioSec)
    const tRender = renderTime(tAudioSec, this.grid, this.lesson.snapWindowMs)
    const widestSec = (this.windows[this.windows.length - 1]?.ms ?? 0) / 1000

    let best: ResponseTarget | null = null
    let bestDelta = Number.POSITIVE_INFINITY
    for (const t of this.responseTargets) {
      if (this.consumed.has(t.index) || t.code !== code) continue
      const delta = tJudge - t.timeSec
      if (Math.abs(delta) <= widestSec && Math.abs(delta) < Math.abs(bestDelta)) {
        best = t
        bestDelta = delta
      }
    }

    let result: HitResult
    if (best !== null) {
      this.consumed.add(best.index)
      const judgment = judgeDelta(bestDelta, this.windows)
      result = {
        kind: 'hit',
        code,
        voice: best.voice,
        judgeTimeSec: tJudge,
        renderTimeSec: tRender,
        gain: HIT_GAIN[judgment],
        judgment,
        deltaSec: bestDelta,
        targetIndex: best.index,
        phraseFinal: best.phraseFinal,
      }
    } else {
      result = {
        kind: 'stray',
        code,
        voice: voiceForKey(this.lesson, code),
        judgeTimeSec: tJudge,
        renderTimeSec: tRender,
        gain: HIT_GAIN.stray,
        judgment: null,
        deltaSec: null,
        targetIndex: null,
        phraseFinal: false,
      }
    }
    this.hits.push(result)
    return result
  }

  /** Phrase accuracy so far: consumed non-late hits / target count. */
  phraseAccuracy(phraseIndex: number): number {
    const targets = this.responseTargets.filter(
      (t) => t.phraseIndex === phraseIndex,
    )
    if (targets.length === 0) return 0
    const good = this.hits.filter(
      (h) =>
        h.kind === 'hit' &&
        h.targetIndex !== null &&
        targets.some((t) => t.index === h.targetIndex) &&
        (h.judgment === 'perfect' || h.judgment === 'good'),
    ).length
    return good / targets.length
  }

  isLayered(phraseIndex: number): boolean {
    return this.phraseAccuracy(phraseIndex) >= LAYER_THRESHOLD
  }

  getHits(): readonly HitResult[] {
    return this.hits
  }

  /** Close the session (any time — quitting keeps everything, §1.5). */
  finalize(): SessionSummary {
    const phrases: PhraseResult[] = this.lesson.phrases.map((_, i) => {
      const targets = this.responseTargets.filter((t) => t.phraseIndex === i)
      const judged: Judgment[] = targets.map((t) => {
        const hit = this.hits.find((h) => h.targetIndex === t.index)
        return hit?.judgment ?? 'miss'
      })
      return {
        phraseIndex: i,
        judged,
        accuracy: this.phraseAccuracy(i),
        layered: this.isLayered(i),
      }
    })

    const judgedHits = this.hits.filter(
      (h): h is HitResult & { deltaSec: number } => h.deltaSec !== null,
    )
    const totalTargets = this.responseTargets.length
    const goodHits = this.hits.filter(
      (h) => h.judgment === 'perfect' || h.judgment === 'good',
    ).length

    return {
      lessonId: this.lesson.id,
      phrases,
      hits: [...this.hits],
      overallAccuracy: totalTargets === 0 ? 0 : goodHits / totalTargets,
      meanAbsErrorMs:
        judgedHits.length === 0
          ? null
          : (judgedHits.reduce((s, h) => s + Math.abs(h.deltaSec), 0) /
              judgedHits.length) *
            1000,
      layeredCount: phrases.filter((p) => p.layered).length,
    }
  }
}
