/**
 * UI-side audio glue. This is the ONLY layer that touches the real
 * AudioContext; the engine (`src/core`) stays DOM/WebAudio-free and receives
 * time through the injected `AudioTimeSource`.
 */
import { TadakClock } from '../core/clock'
import { LookaheadScheduler } from '../core/scheduler'

export const CALIBRATION_OFFSET_KEY = 'tadak.calibrationOffsetMs'

export function loadCalibrationOffsetMs(): number {
  const raw = localStorage.getItem(CALIBRATION_OFFSET_KEY)
  const parsed = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

export function saveCalibrationOffsetMs(offsetMs: number): void {
  localStorage.setItem(CALIBRATION_OFFSET_KEY, String(offsetMs))
}

export interface AudioEngine {
  ctx: AudioContext
  clock: TadakClock
  /** Schedule a click at an exact audio time. Warm, rounded, never shrill. */
  click(timeSec: number, accent?: boolean): void
  makeScheduler(onBeat: (timeSec: number) => void): LookaheadScheduler<number>
  dispose(): void
}

/** Create (and resume) the audio engine. Must be called from a user gesture. */
export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext()
  void ctx.resume()
  const clock = new TadakClock(
    { now: () => ctx.currentTime },
    () => performance.now(),
    loadCalibrationOffsetMs(),
  )

  const click = (timeSec: number, accent = false): void => {
    // Soft sine blip with a fast decay — SPEC §7: warm, low-fatigue.
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = accent ? 880 : 660
    gain.gain.setValueAtTime(0.0001, timeSec)
    gain.gain.exponentialRampToValueAtTime(0.35, timeSec + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, timeSec + 0.08)
    osc.connect(gain).connect(ctx.destination)
    osc.start(timeSec)
    osc.stop(timeSec + 0.1)
  }

  const schedulers: LookaheadScheduler<number>[] = []
  const makeScheduler = (
    onBeat: (timeSec: number) => void,
  ): LookaheadScheduler<number> => {
    const s = new LookaheadScheduler<number>(
      { now: () => ctx.currentTime },
      (ev) => onBeat(ev.timeSec),
      { tickMs: 25, horizonMs: 100 },
    )
    schedulers.push(s)
    return s
  }

  return {
    ctx,
    clock,
    click,
    makeScheduler,
    dispose: () => {
      for (const s of schedulers) s.stop()
      void ctx.close()
    },
  }
}
