/**
 * LookaheadScheduler — Web Audio lookahead pattern (SPEC §7, CLAUDE.md §2).
 *
 * A timer wakes every `tickMs` (default 25ms) and fires every queued event
 * whose scheduled time falls within `now + horizonMs` (default 100ms). The
 * callback receives the EXACT scheduled audio time so audio nodes are started
 * at sample-accurate times (`osc.start(exactTime)`) — the JS timer only has
 * to be roughly on time, never exactly.
 *
 * Purity/determinism: the scheduler never reads wall-clock time itself. Time
 * comes from the injected `AudioTimeSource` and ticks are driven externally —
 * `start()` wires an interval driver (also injected, defaults to
 * setInterval), while tests and offline replay call `tick()` directly with a
 * mocked clock. Same queue + same tick times → identical fire order and
 * identical scheduled times (CLAUDE.md §2, determinism).
 */
import type { AudioTimeSource } from '../clock'

export interface ScheduledEvent<T = unknown> {
  /** Audio time (seconds) the event is scheduled for. */
  timeSec: number
  /** Opaque payload handed back to the callback. */
  data: T
}

export type EventCallback<T> = (event: ScheduledEvent<T>) => void

export interface SchedulerOptions {
  /** Tick period, ms. Default 25. */
  tickMs?: number
  /** Lookahead horizon, ms. Default 100. */
  horizonMs?: number
}

/** Injectable interval driver so the core never touches timers directly. */
export interface IntervalDriver {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export class LookaheadScheduler<T = unknown> {
  readonly tickMs: number
  readonly horizonMs: number

  /** Min-heap-free simple sorted queue; M0 scale is tiny (≪1k events). */
  private queue: ScheduledEvent<T>[] = []
  private handle: unknown = null

  constructor(
    private readonly clock: AudioTimeSource,
    private readonly onEvent: EventCallback<T>,
    options: SchedulerOptions = {},
    private readonly driver: IntervalDriver = {
      set: (fn, ms) => setInterval(fn, ms),
      clear: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    },
  ) {
    this.tickMs = options.tickMs ?? 25
    this.horizonMs = options.horizonMs ?? 100
  }

  /** Queue an event; keeps the queue sorted by time (stable for ties). */
  schedule(timeSec: number, data: T): void {
    const ev: ScheduledEvent<T> = { timeSec, data }
    // insertion sort from the back — appends are the common case
    let i = this.queue.length
    while (i > 0 && this.queue[i - 1]!.timeSec > timeSec) i--
    this.queue.splice(i, 0, ev)
  }

  /** Number of events still waiting. */
  pending(): number {
    return this.queue.length
  }

  /**
   * Fire every event scheduled at or before `now + horizon`.
   * Exposed publicly: tests and offline replay drive this directly.
   * Returns the events fired this tick, in fire order.
   */
  tick(nowSec: number = this.clock.now()): ScheduledEvent<T>[] {
    const limit = nowSec + this.horizonMs / 1000
    const fired: ScheduledEvent<T>[] = []
    while (this.queue.length > 0 && this.queue[0]!.timeSec <= limit) {
      const ev = this.queue.shift()!
      fired.push(ev)
      this.onEvent(ev)
    }
    return fired
  }

  /** Start the interval driver (real-time mode). Idempotent. */
  start(): void {
    if (this.handle !== null) return
    this.handle = this.driver.set(() => this.tick(), this.tickMs)
  }

  /** Stop ticking; queued events remain. Idempotent. */
  stop(): void {
    if (this.handle === null) return
    this.driver.clear(this.handle)
    this.handle = null
  }

  /** Drop all queued events (e.g. leaving a screen). */
  clear(): void {
    this.queue = []
  }
}
