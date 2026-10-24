import { join } from 'node:path'
import { app } from 'electron'

/**
 * Data lives in %APPDATA%/MeuOsteo, never in the install folder. Development runs (`npm run dev`,
 * `npm run seed`) use %APPDATA%/MeuOsteo-dev so that fake data never mixes with real data.
 * Must be called before `app.whenReady()`.
 */
export function configureUserDataPath(): void {
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
