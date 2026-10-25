import { join } from 'node:path'
import { app } from 'electron'

/**
 * Data lives in %APPDATA%/MeuOsteo, never in the install folder. Development runs (`npm run dev`,
 * `npm run seed`) use %APPDATA%/MeuOsteo-dev so that fake data never mixes with real data.
 * Must be called before `app.whenReady()`.
 */
export function configureUserDataPath(): void {
  // End-to-end tests (`npm run e2e`) run on a throw-away folder; never in the installed app.
  const override = !app.isPackaged ? process.env['MEUOSTEO_USER_DATA'] : undefined
  if (override) {
    app.setPath('userData', override)
    return
  }
  const folder = app.isPackaged ? 'MeuOsteo' : 'MeuOsteo-dev'
  app.setPath('userData', join(app.getPath('appData'), folder))
}

export const appPaths = {
  get userData() {
    return app.getPath('userData')
  },
  get databaseFile() {
    return join(app.getPath('userData'), 'meuosteo.db')
  },
  get keyFile() {
    return join(app.getPath('userData'), 'meuosteo.key')
  },
  /** Copied next to app.asar by electron-builder (extraResources). */
  get migrationsFolder() {
    return app.isPackaged
      ? join(process.resourcesPath, 'migrations')
      : join(app.getAppPath(), 'src/main/db/migrations')
  },
  get communesCsv() {
    return app.isPackaged
      ? join(process.resourcesPath, 'communes.csv')
      : join(app.getAppPath(), 'resources/communes.csv')
  },
}
