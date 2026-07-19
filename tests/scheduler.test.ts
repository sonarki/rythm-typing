import { describe, expect, it, vi } from 'vitest'
import {
  LookaheadScheduler,
  type ScheduledEvent,
  type IntervalDriver,
} from '../src/core/scheduler'

function makeScheduler(fired: ScheduledEvent<string>[], nowRef: { t: number }) {
  return new LookaheadScheduler<string>(
    { now: () => nowRef.t },
    (ev) => fired.push(ev),
    { tickMs: 25, horizonMs: 100 },
  )
}

describe('LookaheadScheduler', () => {
  it('defaults to 25ms tick / 100ms horizon', () => {
    const s = makeScheduler([], { t: 0 })
    expect(s.tickMs).toBe(25)
    expect(s.horizonMs).toBe(100)
  })

  it('fires only events within now + horizon, with exact scheduled times', () => {
    const fired: ScheduledEvent<string>[] = []
    const nowRef = { t: 0 }
    const s = makeScheduler(fired, nowRef)
    s.schedule(0.05, 'in-horizon')
    s.schedule(0.099, 'edge')
    s.schedule(0.25, 'later')

    s.tick(0)
    expect(fired.map((e) => e.data)).toEqual(['in-horizon', 'edge'])
    expect(fired.map((e) => e.timeSec)).toEqual([0.05, 0.099])
    expect(s.pending()).toBe(1)

    s.tick(0.2)
    expect(fired.map((e) => e.data)).toEqual(['in-horizon', 'edge', 'later'])
  })

  it('fires in time order regardless of insertion order, stable on ties', () => {
    const fired: ScheduledEvent<string>[] = []
    const s = makeScheduler(fired, { t: 0 })
    s.schedule(0.09, 'b')
    s.schedule(0.01, 'a')
    s.schedule(0.09, 'c') // tie with b, inserted later
    s.tick(0)
    expect(fired.map((e) => e.data)).toEqual(['a', 'b', 'c'])
  })

  it('uses the injected clock when tick() is called without a time', () => {
    const fired: ScheduledEvent<string>[] = []
    const nowRef = { t: 1.0 }
    const s = makeScheduler(fired, nowRef)
    s.schedule(1.05, 'x')
    s.tick()
    expect(fired).toHaveLength(1)
  })

  it('drives ticks through the injected interval driver on start/stop', () => {
    let intervalFn: (() => void) | null = null
    const driver: IntervalDriver = {
      set: vi.fn((fn: () => void) => {
        intervalFn = fn
        return 'handle'
      }),
      clear: vi.fn(),
    }
    const fired: ScheduledEvent<string>[] = []
    const nowRef = { t: 0 }
    const s = new LookaheadScheduler<string>(
      { now: () => nowRef.t },
      (ev) => fired.push(ev),
      {},
      driver,
    )
    s.schedule(0.05, 'x')
    s.start()
    s.start() // idempotent
    expect(driver.set).toHaveBeenCalledTimes(1)
    expect(driver.set).toHaveBeenCalledWith(expect.any(Function), 25)

    intervalFn!()
    expect(fired.map((e) => e.data)).toEqual(['x'])

    s.stop()
    s.stop() // idempotent
    expect(driver.clear).toHaveBeenCalledTimes(1)
  })

  it('clear() drops queued events', () => {
    const s = makeScheduler([], { t: 0 })
    s.schedule(5, 'x')
    expect(s.pending()).toBe(1)
    s.clear()
    expect(s.pending()).toBe(0)
  })
})
