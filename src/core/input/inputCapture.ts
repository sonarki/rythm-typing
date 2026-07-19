/**
 * InputCapture — raw key capture with `performance.now()` timestamps.
 *
 * Zero DOM imports (CLAUDE.md §2): the capture consumes event-shaped plain
 * objects; the UI layer wires real `keydown`/`keyup` listeners and forwards
 * them. Key-repeat is filtered two ways — the event's own `repeat` flag AND a
 * held-key set (belt and suspenders; some environments miss the flag).
 *
 * The session log is the SPEC §4.5 format `{code, tPerf}` — append-only,
 * deterministic input to replays, Session Tapes, and the M0 determinism
 * proof. `tPerf` is captured by the caller AT the event (never re-sampled
 * here) so timestamps survive any queueing between DOM and engine.
 */

/** SPEC §4.5 log entry. tPerf = performance.now() ms at the keydown. */
export interface InputLogEntry {
  code: string
  tPerf: number
}

/** The subset of KeyboardEvent the engine consumes. */
export interface RawKeyEvent {
  code: string
  repeat?: boolean
}

export type InputListener = (entry: InputLogEntry) => void

export class InputCapture {
  private held = new Set<string>()
  private log: InputLogEntry[] = []
  private listeners: InputListener[] = []

  /** Feed a keydown. Returns the log entry, or null if filtered as repeat. */
  keyDown(event: RawKeyEvent, tPerf: number): InputLogEntry | null {
    if (event.repeat === true) return null
    if (this.held.has(event.code)) return null
    this.held.add(event.code)
    const entry: InputLogEntry = { code: event.code, tPerf }
    this.log.push(entry)
    for (const l of this.listeners) l(entry)
    return entry
  }

  /** Feed a keyup; releases the held state so the next keydown counts. */
  keyUp(event: RawKeyEvent): void {
    this.held.delete(event.code)
  }

  onInput(listener: InputListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /** Append-only view of the session log. */
  getLog(): readonly InputLogEntry[] {
    return this.log
  }
}
