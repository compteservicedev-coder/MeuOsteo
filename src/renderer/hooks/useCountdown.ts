import { useEffect, useState } from 'react'

/** Seconds left until `until` (epoch ms), refreshed twice a second; 0 when reached or null. */
export function useCountdown(until: number | null): number {
  const compute = () => (until === null ? 0 : Math.max(0, Math.ceil((until - Date.now()) / 1000)))
  const [seconds, setSeconds] = useState(compute)
  useEffect(() => {
    setSeconds(compute())
    if (until === null) return
    const timer = window.setInterval(() => {
      const left = compute()
      setSeconds(left)
      if (left === 0) window.clearInterval(timer)
    }, 500)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until])
  return seconds
}
