/// <reference types="vite/client" />
import type { MeuOsteoApi } from '@shared/types/ipc'

declare global {
  interface Window {
    /** Exposed by src/preload: the renderer's only way to reach the main process. */
    api: MeuOsteoApi
  }
}
