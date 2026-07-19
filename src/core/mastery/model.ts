/**
 * Mastery Model skeleton (Addendum §A.1) — M1 scope: DATA CAPTURE ONLY.
 *
 * Records per-key and per-bigram (key-pair) observations from every judged
 * hit: attempt/hit counts, mean absolute timing error, and last-seen time
 * (stored so the spaced-repetition decay of §A.1 can be computed later —
 * the decay/difficulty/drill-selection logic itself is M2+ and deliberately
 * absent here).
 *
 * Keys are opaque strings: use jamo for Korean (jamo-level mastery) and
 * characters/codes for English. Syllable-pattern nodes (e.g. 겹받침) are
 * captured by recording pattern keys like 'pattern:겹받침' alongside jamo.
 *
 * Serializable (`toJSON`/`fromJSON`) for localStorage persistence.
 * Deterministic and side-effect free: time enters only through `at` values
 * supplied by the caller (never Date.now() — CLAUDE.md §1.8).
 */
import type { Judgment } from '../judge'

export interface MasteryObservation {
  /** Skill node key: a jamo, a character, or a pattern tag. */
  key: string
  judgment: Judgment
  /** Absolute timing error in ms; null for unhit misses. */
  errorMs: number | null
  /** Caller-supplied timestamp (ms). Basis for future decay. */
  at: number
}

export interface MasteryNode {
  attempts: number
  /** Judgments other than 'miss'. */
  hits: number
  /** Sum of |error| over observations that carried an error. */
  errorSumMs: number
  /** Count of observations that carried an error. */
  errorCount: number
  lastAt: number
}

export interface MasteryNodeStats extends MasteryNode {
  accuracy: number
  meanAbsErrorMs: number | null
}

export interface MasterySnapshot {
  keys: Record<string, MasteryNode>
  bigrams: Record<string, MasteryNode>
}

const emptyNode = (): MasteryNode => ({
  attempts: 0,
  hits: 0,
  errorSumMs: 0,
  errorCount: 0,
  lastAt: 0,
})

function update(node: MasteryNode, obs: MasteryObservation): void {
  node.attempts += 1
  if (obs.judgment !== 'miss') node.hits += 1
  if (obs.errorMs !== null) {
    node.errorSumMs += Math.abs(obs.errorMs)
    node.errorCount += 1
  }
  node.lastAt = Math.max(node.lastAt, obs.at)
}

function stats(node: MasteryNode): MasteryNodeStats {
  return {
    ...node,
    accuracy: node.attempts === 0 ? 0 : node.hits / node.attempts,
    meanAbsErrorMs:
      node.errorCount === 0 ? null : node.errorSumMs / node.errorCount,
  }
}

export class MasteryModel {
  private keys = new Map<string, MasteryNode>()
  private bigrams = new Map<string, MasteryNode>()
  private prevKey: string | null = null

  /** Record one judged hit. Bigram = (previous key → this key). */
  record(obs: MasteryObservation): void {
    const keyNode = this.keys.get(obs.key) ?? emptyNode()
    update(keyNode, obs)
    this.keys.set(obs.key, keyNode)

    if (this.prevKey !== null) {
      const bigramKey = `${this.prevKey}>${obs.key}`
      const bigramNode = this.bigrams.get(bigramKey) ?? emptyNode()
      update(bigramNode, obs)
      this.bigrams.set(bigramKey, bigramNode)
    }
    this.prevKey = obs.key
  }

  /** Break the bigram chain (phrase/session boundary). */
  resetChain(): void {
    this.prevKey = null
  }

  keyStats(key: string): MasteryNodeStats | null {
    const node = this.keys.get(key)
    return node === undefined ? null : stats(node)
  }

  bigramStats(from: string, to: string): MasteryNodeStats | null {
    const node = this.bigrams.get(`${from}>${to}`)
    return node === undefined ? null : stats(node)
  }

  trackedKeys(): string[] {
    return [...this.keys.keys()]
  }

  toJSON(): MasterySnapshot {
    return {
      keys: Object.fromEntries(this.keys),
      bigrams: Object.fromEntries(this.bigrams),
    }
  }

  static fromJSON(snapshot: MasterySnapshot): MasteryModel {
    const model = new MasteryModel()
    for (const [k, v] of Object.entries(snapshot.keys)) {
      model.keys.set(k, { ...v })
    }
    for (const [k, v] of Object.entries(snapshot.bigrams)) {
      model.bigrams.set(k, { ...v })
    }
    return model
  }
}
