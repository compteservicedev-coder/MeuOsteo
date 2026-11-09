import { Menu, app, powerMonitor, type BrowserWindow } from 'electron'
import { registerIpcHandlers } from './ipc'
import { clearOpenedDocuments } from './ipc/documentHandlers'
import { initLogger, log } from './logger'
import { configureUserDataPath } from './paths'
import { startRuntime, stopRuntime, type RuntimeResult } from './runtime'
import { hardenApp, hardenSession } from './security'
import { trustSystemCertificates } from './systemCertificates'
import { createMainWindow, isTrustedSender } from './window'

configureUserDataPath()
// Before any Gmail connection: antivirus e-mail scanning uses an authority installed in Windows.
trustSystemCertificates()
// French UI everywhere, including native date fields (JJ/MM/AAAA).
app.commandLine.appendSwitch('lang', 'fr-FR')

const seedMode = !app.isPackaged && process.argv.includes('--seed')

if (seedMode) {
  // `npm run seed`: no window, fill the development database and quit.
  void app.whenReady().then(async () => {
    initLogger()
    const { runSeed } = await import('./seedRunner')
    app.exit(runSeed(process.argv))
  })
} else if (!app.requestSingleInstanceLock()) {
  // One instance only: two processes must never write to the same database.
  app.quit()
} else {
  startApp()
}

function startApp(): void {
  let mainWindow: BrowserWindow | null = null
  let started: RuntimeResult | null = null
  let resolveStartup!: (result: RuntimeResult) => void
  const startup = new Promise<RuntimeResult>((resolve) => (resolveStartup = resolve))

  initLogger()
  hardenApp()
  Menu.setApplicationMenu(null)

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    hardenSession()
    registerIpcHandlers({ startup, isTrustedSender }, app.getVersion())
    mainWindow = createMainWindow()
    mainWindow.on('closed', () => (mainWindow = null))

    // Opening the database is synchronous: let the window paint the opening screen first.
    setTimeout(() => {
      started = startRuntime({ allowUnprotectedKey: !app.isPackaged })
      clearOpenedDocuments()
      resolveStartup(started)
      // R-28: is a newer version published? At start-up, then each day (installed app only:
      // development and end-to-end runs stay offline).
      if (started.ok && app.isPackaged) {
        const { updates } = started.runtime
        void updates.check()
        setInterval(() => void updates.check(), 6 * 60 * 60 * 1000)
      }
    }, 0)

    // R-21: the code is asked again after a system sleep or a session lock.
    const lockNow = () => {
      void startup.then((result) => {
        if (!result.ok || !result.runtime.accessCode.lock().locked) return
        mainWindow?.webContents.send('security:locked')
      })
    }
    powerMonitor.on('lock-screen', lockNow)
    powerMonitor.on('suspend', lockNow)
  })

  app.on('window-all-closed', () => app.quit())

  app.on('will-quit', () => {
    // R-22: a backup at each closing (skipped right after a restore was prepared).
    if (started?.ok && !process.env['MEUOSTEO_SKIP_CLOSE_BACKUP'])
      started.runtime.backup.backupNow()
    if (started?.ok) stopRuntime(started.runtime)
    clearOpenedDocuments()
    log.info('Application closed')
  })
}
