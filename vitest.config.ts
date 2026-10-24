import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer'),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: [
            ...Object.entries(alias).map(([find, replacement]) => ({ find, replacement })),
            // Same as electron.vite.config.ts: Drizzle must load the encrypted SQLite build.
            { find: /^better-sqlite3$/, replacement: 'better-sqlite3-multiple-ciphers' },
          ],
        },
        test: {
          name: 'node',
          environment: 'node',
          server: { deps: { inline: ['drizzle-orm'] } },
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/test/setup.ts'],
        },
      },
    ],
  },
})
