import type { AppDatabase } from '../db/client'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { DEFAULT_SECURITY_SETTINGS, securitySettingsSchema, type SecurityStore } from './accessCode'

export const SECURITY_SETTING_KEY = 'security'

export function createSecurityStore(db: AppDatabase): SecurityStore {
  return {
    load: () =>
      getSetting(db, SECURITY_SETTING_KEY, securitySettingsSchema, DEFAULT_SECURITY_SETTINGS),
    save: (settings) => setSetting(db, SECURITY_SETTING_KEY, settings),
  }
}
