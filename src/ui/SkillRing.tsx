/**
 * Skill Ring v1 (addendum §B.3): one ring — thickness = key coverage,
 * tightness (low wobble) = rhythm precision. Monochrome + the accent only.
 */
import { useEffect, useRef } from 'react'
import type { SkillRing as SkillRingData } from '../core/mastery'

export function SkillRing({
  ring,
  size = 110,
}: {
  ring: SkillRingData
  size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const g = canvas.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 14
    const thickness = 2 + ring.coverage * 8
    // Imprecision = wobble. 0ms → perfect circle; ≥120ms → visibly loose.
    const wobble = Math.min(ring.precisionMs ?? 120, 120) / 120

    const drawRing = (from: number, to: number, style: string, width: number) => {
      g.strokeStyle = style
      g.lineWidth = width
      g.beginPath()
      const steps = 90
      for (let i = 0; i <= steps; i++) {
        const a = from + (to - from) * (i / steps)
        const jitter =
          wobble * 3 * Math.sin(a * 7 + wobble * 13) * Math.sin(a * 3)
        const x = cx + (r + jitter) * Math.cos(a - Math.PI / 2)
        const y = cy + (r + jitter) * Math.sin(a - Math.PI / 2)
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }

    drawRing(0, Math.PI * 2, '#1a1a1a', 1)
    if (ring.coverage > 0) {
      drawRing(0, Math.PI * 2 * ring.coverage, '#d85a30', thickness)
    }
  }, [ring, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block' }}
      aria-label={`skill ring: coverage ${(ring.coverage * 100).toFixed(0)}%, precision ${ring.precisionMs?.toFixed(0) ?? '—'}ms`}
    />
  )
}
