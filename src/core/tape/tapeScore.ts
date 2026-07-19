/**
 * Session Tape score builder (SPEC §4.5, §5 completion ritual).
 *
 * Turns a finished (or abandoned — §1.5: nothing is thrown away) percussion
 * session into a pure, schedulable score: a count-in, every response hit at
 * its Grace-rendered time with its judgment-derived gain, layered phrase
 * loops underneath, and a breathing tail. The UI renders this through the
 * SAME sound pack into an OfflineAudioContext → WAV.
 *
 * Pure data in, pure data out — deterministic, testable, replayable.
 */
import type { VoiceId } from '../percussion'
import type { HitResult, SessionSummary, CallEvent } from '../percussion'

export interface TapeEvent {
  /** Seconds from tape start. */
  timeSec: number
  voice: VoiceId
  gain: number
}

export interface TapeScore {
  events: TapeEvent[]
  /** Total tape length including tail, seconds. */
  durationSec: number
  /** Where the count-in ends and the performance starts. */
  performanceStartSec: number
}

export interface TapeOptions {
  /** BPM for the count-in clicks. */
  bpm: number
  /** Count-in beats. Default 4. */
  countInBeats?: number
  /** Hard cap on tape length (SPEC §3.1 ~30s). Default 32. */
  maxDurationSec?: number
  /** Silence after the last event. Default 1.5. */
  tailSec?: number
  /** Gain for layered backing loops. Default 0.35. */
  layerGain?: number
}

/**
 * Build the tape from session output.
 * - `sessionStartSec` anchors the session's audio times to tape-time 0.
 * - Layered phrases (summary.phrases[i].layered) contribute their CALL
 *   pattern as a soft backing loop under the response half of every LATER
 *   phrase — the "growing groove" made audible in the artifact.
 */
export function buildTapeScore(
  summary: SessionSummary,
  hits: readonly HitResult[],
  callEvents: readonly CallEvent[],
  sessionStartSec: number,
  options: TapeOptions,
): TapeScore {
  const countInBeats = options.countInBeats ?? 4
  const maxDurationSec = options.maxDurationSec ?? 32
  const tailSec = options.tailSec ?? 1.5
  const layerGain = options.layerGain ?? 0.35
  const secPerBeat = 60 / options.bpm
  const countInSec = countInBeats * secPerBeat

  const events: TapeEvent[] = []

  // Count-in: soft hat clicks.
  for (let i = 0; i < countInBeats; i++) {
    events.push({ timeSec: i * secPerBeat, voice: 'hat', gain: 0.25 })
  }

  // Player hits at Grace-rendered times (the kind timeline is what you hear).
  for (const h of hits) {
    if (h.voice === null) continue
    events.push({
      timeSec: countInSec + (h.renderTimeSec - sessionStartSec),
      voice: h.voice,
      gain: h.gain,
    })
  }

  // Layered grooves: each layered phrase's call pattern echoes (softly)
  // shifted into every later phrase's response half.
  const layered = summary.phrases.filter((p) => p.layered).map((p) => p.phraseIndex)
  for (const li of layered) {
    const pattern = callEvents.filter((c) => c.phraseIndex === li)
    for (const later of summary.phrases) {
      if (later.phraseIndex <= li) continue
      const laterCalls = callEvents.filter(
        (c) => c.phraseIndex === later.phraseIndex,
      )
      if (laterCalls.length === 0) continue
      const offset =
        laterCalls[0]!.timeSec - pattern[0]!.timeSec
      for (const c of pattern) {
        events.push({
          timeSec: countInSec + (c.timeSec + offset - sessionStartSec),
          voice: c.voice,
          gain: layerGain,
        })
      }
    }
  }

  // Sort, then cap (drop anything past the cap — a partial tape is a tape).
  events.sort((a, b) => a.timeSec - b.timeSec || a.voice.localeCompare(b.voice))
  const capped = events.filter((e) => e.timeSec <= maxDurationSec)
  const lastSec = capped.length > 0 ? capped[capped.length - 1]!.timeSec : 0

  return {
    events: capped,
    durationSec: lastSec + tailSec,
    performanceStartSec: countInSec,
  }
}
