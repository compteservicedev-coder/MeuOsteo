import { useEffect } from 'react'

const EVENT = 'meuosteo:data-changed'

/** Tells the shell (« À rapprocher » badge…) that records changed: import, merge. */
export function notifyDataChanged(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function useDataChanged(listener: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }, [listener])
}
