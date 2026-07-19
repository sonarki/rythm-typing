import { describe, expect, it } from 'vitest'
import { InputCapture } from '../src/core/input'

describe('InputCapture', () => {
  it('logs {code, tPerf} in append-only order', () => {
    const c = new InputCapture()
    c.keyDown({ code: 'KeyA' }, 100)
    c.keyUp({ code: 'KeyA' })
    c.keyDown({ code: 'KeyB' }, 150)
    expect(c.getLog()).toEqual([
      { code: 'KeyA', tPerf: 100 },
      { code: 'KeyB', tPerf: 150 },
    ])
  })

  it('filters events flagged repeat', () => {
    const c = new InputCapture()
    c.keyDown({ code: 'KeyA' }, 100)
    c.keyUp({ code: 'KeyA' })
    expect(c.keyDown({ code: 'KeyA', repeat: true }, 130)).toBeNull()
    expect(c.getLog()).toHaveLength(1)
  })

  it('filters held keys even without the repeat flag', () => {
    const c = new InputCapture()
    c.keyDown({ code: 'KeyA' }, 100)
    expect(c.keyDown({ code: 'KeyA' }, 120)).toBeNull() // still held
    c.keyUp({ code: 'KeyA' })
    expect(c.keyDown({ code: 'KeyA' }, 140)).not.toBeNull()
    expect(c.getLog().map((e) => e.tPerf)).toEqual([100, 140])
  })

  it('notifies listeners and supports unsubscribe', () => {
    const c = new InputCapture()
    const seen: string[] = []
    const off = c.onInput((e) => seen.push(e.code))
    c.keyDown({ code: 'KeyA' }, 1)
    off()
    c.keyDown({ code: 'KeyB' }, 2)
    expect(seen).toEqual(['KeyA'])
  })
})
