import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(() => cleanup())

// jsdom does not implement scrolling; components call it after animations.
window.scrollTo = () => {}
Element.prototype.scrollIntoView ??= () => {}
