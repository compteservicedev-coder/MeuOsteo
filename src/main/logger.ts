import log from 'electron-log/main'

/**
 * Technical log (userData/logs/main.log). Never log medical content (anamnèse, pratique, motif,
 * commentaire) nor names: technical identifiers only.
 */
export function initLogger(): typeof log {
  log.transports.file.level = 'info'
  log.transports.console.level = 'warn'
  log.errorHandler.startCatching({ showDialog: false })
  return log
}

export { log }
