import { app, session } from 'electron'

/**
 * Electron hardening: the app shows only its own bundled page. No navigation, no new windows,
 * no webviews, no permission (camera, notifications, geolocation…).
 */
export function hardenApp(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => event.preventDefault())
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })
}

export function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
}
