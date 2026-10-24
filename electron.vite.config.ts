import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer'),
}

/**
 * Drizzle's driver imports `better-sqlite3`; the app uses the API-compatible encrypted build.
 * Drizzle is a devDependency, so it is bundled into main and this alias applies to it.
 */
const sqliteAlias = [{ find: /^better-sqlite3$/, replacement: 'better-sqlite3-multiple-ciphers' }]

export default defineConfig({
  main: {
    resolve: {
      alias: [
        ...Object.entries(alias).map(([find, replacement]) => ({ find, replacement })),
        ...sqliteAlias,
      ],
    },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias },
    plugins: [react()],
    build: {
      minify: true,
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
    },
  },
})
