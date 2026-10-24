import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, app, type IpcMainInvokeEvent } from 'electron'

const rendererFile = () => join(__dirname, '../renderer/index.html')

/** The only page allowed to call `window.api`: the dev server in development, the bundle otherwise. */
export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  if (!url) return false
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) return url.startsWith(devUrl)
  return url.split(/[?#]/)[0] === pathToFileURL(rendererFile()).href
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'MeuOsteo',
    // Same colour as the opening screen: no white flash before the first paint.
    backgroundColor: '#0A1433',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  })

  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })

  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
    })
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(rendererFile())
  return win
}
