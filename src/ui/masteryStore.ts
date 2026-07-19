/**
 * Mastery persistence (localStorage) + session → model capture.
 * UI-side glue; the model itself is pure core.
 */
import { MasteryModel, type MasterySnapshot } from '../core/mastery'
import type { PercussionSession, SessionSummary } from '../core/percussion'

const KEY = 'tadak.mastery.v1'

export function loadMastery(): MasteryModel {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return new MasteryModel()
    return MasteryModel.fromJSON(JSON.parse(raw) as MasterySnapshot)
  } catch {
    return new MasteryModel()
  }
}

export function saveMastery(model: MasteryModel): void {
  localStorage.setItem(KEY, JSON.stringify(model.toJSON()))
}

/**
 * Capture a finished percussion session into the model: one observation per
 * response target (misses included), bigram chain reset at phrase edges.
 */
export function captureSession(
  model: MasteryModel,
  session: PercussionSession,
  summary: SessionSummary,
  at: number,
): void {
  const hitByTarget = new Map(
    summary.hits
      .filter((h) => h.targetIndex !== null)
      .map((h) => [h.targetIndex!, h]),
  )
  let phrase = -1
  for (const target of session.responseTargets) {
    if (target.phraseIndex !== phrase) {
      model.resetChain()
      phrase = target.phraseIndex
    }
    const hit = hitByTarget.get(target.index)
    model.record({
      key: target.code,
      judgment: hit?.judgment ?? 'miss',
      errorMs: hit?.deltaSec != null ? hit.deltaSec * 1000 : null,
      at,
    })
  }
  model.resetChain()
}

const OVERRIDE_KEY = 'tadak.guideOverride'
export type GuideOverride = 'auto' | '0' | '1' | '2'

export function loadGuideOverride(): GuideOverride {
  const v = localStorage.getItem(OVERRIDE_KEY)
  return v === '0' || v === '1' || v === '2' ? v : 'auto'
}

export function saveGuideOverride(v: GuideOverride): void {
  localStorage.setItem(OVERRIDE_KEY, v)
}
