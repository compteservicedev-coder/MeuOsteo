import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Calls `onIdle` after `timeoutMs` without any keyboard, mouse or touch activity in the window.
 * `null` disables the timer.
 */
export function useInactivity(timeoutMs: number | null, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (timeoutMs === null) return
    let timer = window.setTimeout(() => onIdleRef.current(), timeoutMs)
    let last = Date.now()
    const reset = () => {
      // pointermove fires very often: restart the timer at most once per second.
      const now = Date.now()
      if (now - last < 1000) return
      last = now
      window.clearTimeout(timer)
      timer = window.setTimeout(() => onIdleRef.current(), timeoutMs)
    }
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset)
    }
  }, [timeoutMs])
}
