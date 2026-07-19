import { describe, expect, it } from 'vitest'
import {
  judgeDelta,
  judgeChart,
  DEFAULT_WINDOWS,
  type ChartNote,
} from '../src/core/judge'

describe('judgeDelta — table-driven windows', () => {
  it.each([
    [0, 'perfect'],
    [0.03, 'perfect'],
    [-0.03, 'perfect'],
    [0.031, 'good'],
    [-0.08, 'good'],
    [0.081, 'late'],
    [-0.16, 'late'],
    [0.161, 'miss'],
    [-1, 'miss'],
  ] as const)('Δ %ss → %s', (delta, expected) => {
    expect(judgeDelta(delta)).toBe(expected)
  })

  it('honors a custom window table (tunable, not hardcoded)', () => {
    const tight = [{ judgment: 'perfect' as const, ms: 10 }]
    expect(judgeDelta(0.009, tight)).toBe('perfect')
    expect(judgeDelta(0.011, tight)).toBe('miss')
  })
})

describe('judgeChart', () => {
  const chart: ChartNote[] = [
    { timeSec: 1, code: 'Space' },
    { timeSec: 2, code: 'Space' },
    { timeSec: 3, code: 'Space' },
  ]

  it('judges each note and marks unhit notes as misses', () => {
    const result = judgeChart(chart, [
      { timeSec: 1.01, code: 'Space' }, // perfect
      { timeSec: 2.06, code: 'Space' }, // good
    ])
    expect(result.map((r) => r.judgment)).toEqual(['perfect', 'good', 'miss'])
    expect(result[0]!.deltaSec).toBeCloseTo(0.01, 10)
    expect(Number.isNaN(result[2]!.deltaSec)).toBe(true)
  })

  it('consumes each input at most once', () => {
    const result = judgeChart(
      [
        { timeSec: 1, code: 'Space' },
        { timeSec: 1.05, code: 'Space' },
      ],
      [{ timeSec: 1.02, code: 'Space' }],
    )
    // one input cannot clear two notes
    expect(result.filter((r) => r.judgment !== 'miss')).toHaveLength(1)
  })

  it('matches by key code; wrong-key inputs never clear a note', () => {
    const result = judgeChart(chart, [{ timeSec: 1.0, code: 'KeyA' }])
    expect(result[0]!.judgment).toBe('miss')
  })

  it("code '' matches any key", () => {
    const result = judgeChart(
      [{ timeSec: 1, code: '' }],
      [{ timeSec: 1.0, code: 'KeyZ' }],
    )
    expect(result[0]!.judgment).toBe('perfect')
  })

  it('ignores inputs outside the widest window', () => {
    const result = judgeChart(chart, [{ timeSec: 1.5, code: 'Space' }])
    expect(result.map((r) => r.judgment)).toEqual(['miss', 'miss', 'miss'])
  })

  it('is deterministic: identical inputs → identical serialized output', () => {
    const inputs = [
      { timeSec: 1.01, code: 'Space' },
      { timeSec: 2.9, code: 'Space' },
    ]
    const a = JSON.stringify(judgeChart(chart, inputs, DEFAULT_WINDOWS))
    const b = JSON.stringify(judgeChart(chart, inputs, DEFAULT_WINDOWS))
    expect(a).toBe(b)
  })
})
