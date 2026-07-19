/**
 * Lo-fi kit sound pack — fully synthesized (Web Audio), zero external
 * assets (see assets/CREDITS.md). One function per voice, parameterized by
 * BaseAudioContext so the SAME code renders live playback AND the offline
 * Session Tape (determinism between what you played and what you export).
 *
 * Palette per SPEC §7: warm, rounded, low-fatigue. Every one-shot is
 * lowpass-capped so nothing is ever shrill; misses/strays only get quieter,
 * never uglier (CLAUDE.md §1.1).
 */
import type { VoiceId } from '../core/percussion'

export interface Voice {
  play(
    ctx: BaseAudioContext,
    destination: AudioNode,
    timeSec: number,
    gain: number,
  ): void
}

/** Deterministic per-call pitch variation, seeded by schedule time. */
function vary(timeSec: number, cents: number): number {
  // Hash the time to [-1, 1] — deterministic, so tape === live.
  const x = Math.sin(timeSec * 12.9898) * 43758.5453
  const r = (x - Math.floor(x)) * 2 - 1
  return 2 ** ((r * cents) / 1200)
}

const kick: Voice = {
  play(ctx, dest, t, gain) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    const f = 120 * vary(t, 30)
    osc.frequency.setValueAtTime(f, t)
    osc.frequency.exponentialRampToValueAtTime(f * 0.38, t + 0.12)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9 * gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(g).connect(dest)
    osc.start(t)
    osc.stop(t + 0.25)
  },
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  // Deterministic pseudo-noise (xorshift) — tape renders are repeatable.
  const len = Math.floor(ctx.sampleRate * 0.3)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let s = 0x9e3779b9
  for (let i = 0; i < len; i++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    data[i] = ((s >>> 0) / 0xffffffff) * 2 - 1
  }
  return buf
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
function getNoise(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx)
  if (buf === undefined) {
    buf = noiseBuffer(ctx)
    noiseCache.set(ctx, buf)
  }
  return buf
}

const snare: Voice = {
  play(ctx, dest, t, gain) {
    const src = ctx.createBufferSource()
    src.buffer = getNoise(ctx)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1800 * vary(t, 40)
    band.Q.value = 0.9
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200 // brightness hard-cap
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.55 * gain, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    // body thump under the noise
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(190 * vary(t, 25), t)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.35 * gain, t + 0.004)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    src.connect(band).connect(lp).connect(g).connect(dest)
    osc.connect(og).connect(dest)
    src.start(t)
    src.stop(t + 0.2)
    osc.start(t)
    osc.stop(t + 0.12)
  },
}

const hat: Voice = {
  play(ctx, dest, t, gain) {
    const src = ctx.createBufferSource()
    src.buffer = getNoise(ctx)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6000
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 9500 // keep the top rounded, lo-fi
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22 * gain, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    src.connect(hp).connect(lp).connect(g).connect(dest)
    src.start(t)
    src.stop(t + 0.08)
  },
}

const rim: Voice = {
  play(ctx, dest, t, gain) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880 * vary(t, 35), t)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4000
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.4 * gain, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    osc.connect(lp).connect(g).connect(dest)
    osc.start(t)
    osc.stop(t + 0.09)
  },
}

export const LOFI_KIT: Readonly<Record<VoiceId, Voice>> = {
  kick,
  snare,
  hat,
  rim,
}

/**
 * Master bus per SPEC §7: gentle glue compression, never clip.
 * Returns the node to connect voices into.
 */
export function createMasterBus(ctx: BaseAudioContext): AudioNode {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 24
  comp.ratio.value = 3
  comp.attack.value = 0.004
  comp.release.value = 0.18
  const trim = ctx.createGain()
  trim.gain.value = 0.9
  comp.connect(trim).connect(ctx.destination)
  return comp
}

export function playVoice(
  ctx: BaseAudioContext,
  bus: AudioNode,
  voice: VoiceId,
  timeSec: number,
  gain: number,
): void {
  LOFI_KIT[voice].play(ctx, bus, timeSec, gain)
}
