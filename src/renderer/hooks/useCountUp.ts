import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animated counter (ease-out, 1.1 s) for the dashboard indicators; instant with reduced motion. */
export function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (reducedMotion()) {
      setValue(target)
      return
    }
    const start = performance.now()
    const origin = from.current
    let raf = 0
    const tick = (t: number) => {
      const x = Math.min(1, (t - start) / durationMs)
      const v = origin + (target - origin) * (1 - Math.pow(1 - x, 3))
      setValue(v)
      from.current = v
      if (x < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}
