/**
 * Returns `shake-a` / `shake-b` alternately each time `signal` increases, so that the CSS
 * animation restarts. Returns '' before the first increment.
 */
export function useShakeClass(signal: number): string {
  if (signal <= 0) return ''
  return signal % 2 ? 'shake-a' : 'shake-b'
}
