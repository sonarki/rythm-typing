/**
 * Skill Ring v1 + progressive-guide math (addendum §B.3, §B.1).
 * Pure reads over the Mastery Model — no policy writes back.
 *
 * Skill Ring: one ring — thickness = coverage (fraction of tracked keys
 * mastered), tightness = rhythm precision (mean abs error, ms). The UI draws
 * it; this computes it.
 *
 * Guide level (progressive UI density): 0 = full keyboard guide with
 * finger-zone glow (novice), 1 = outline guide, 2 = minimal lane (expert).
 * Driven by mastery, manually overridable in the UI.
 */
import type { MasteryModel } from './model'

export interface SkillRing {
  /** 0..1 — fraction of `keys` that are mastered. */
  coverage: number
  /** Mean abs timing error across keys with data, ms; null = no data. */
  precisionMs: number | null
}

export interface SkillRingConfig {
  /** Attempts needed before a key can count as mastered. Default 5. */
  minAttempts?: number
  /** Accuracy needed for mastery. Default 0.8. */
  minAccuracy?: number
}

export function computeSkillRing(
  model: MasteryModel,
  keys: readonly string[],
  config: SkillRingConfig = {},
): SkillRing {
  const minAttempts = config.minAttempts ?? 5
  const minAccuracy = config.minAccuracy ?? 0.8

  let mastered = 0
  let errorSum = 0
  let errorKeys = 0
  for (const key of keys) {
    const s = model.keyStats(key)
    if (s === null) continue
    if (s.attempts >= minAttempts && s.accuracy >= minAccuracy) mastered++
    if (s.meanAbsErrorMs !== null) {
      errorSum += s.meanAbsErrorMs
      errorKeys++
    }
  }
  return {
    coverage: keys.length === 0 ? 0 : mastered / keys.length,
    precisionMs: errorKeys === 0 ? null : errorSum / errorKeys,
  }
}

export type GuideLevel = 0 | 1 | 2

/**
 * Progressive keyboard-guide density from mastery of the given keys:
 * - level 0 while coverage < 0.5 (full glow guide),
 * - level 1 while coverage < 0.9 or precision ≥ 45ms (outline guide),
 * - level 2 once coverage ≥ 0.9 AND precision < 45ms (minimal).
 */
export function guideLevel(
  model: MasteryModel,
  keys: readonly string[],
  config: SkillRingConfig = {},
): GuideLevel {
  const ring = computeSkillRing(model, keys, config)
  if (ring.coverage < 0.5) return 0
  if (ring.coverage < 0.9 || ring.precisionMs === null || ring.precisionMs >= 45) {
    return 1
  }
  return 2
}
