/**
 * Settings Store
 * CRUD operations for application settings
 */

import { getDatabase } from '../index'
import type { SettingsRecord, AppSettings } from './types'

/**
 * Get a setting value by key
 */
export function getSetting(key: string): string | undefined {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

/**
 * Set a setting value
 */
export function setSetting(key: string, value: string): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `).run(key, value)
}

/**
 * Delete a setting
 */
export function deleteSetting(key: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM settings WHERE key = ?').run(key)
}

/**
 * Get all settings as key-value pairs
 */
export function getAllSettings(): Record<string, string> {
  const db = getDatabase()
  const rows = db.prepare('SELECT key, value FROM settings').all() as SettingsRecord[]
  
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

/**
 * Get app settings as typed object
 */
export function getAppSettings(): AppSettings {
  const settings = getAllSettings()
  
  return {
    syncDirectory: settings.syncDirectory ?? '',
    linebreak: settings.linebreak === 'true',
    latexcode: settings.latexcode === 'true',
    theme: (settings.theme as AppSettings['theme']) ?? 'system',
    autoSyncInterval: settings.autoSyncInterval ? parseInt(settings.autoSyncInterval, 10) as AppSettings['autoSyncInterval'] : 0,
    autoSyncOnOpen: settings.autoSyncOnOpen === 'true',
    documentListWidth: settings.documentListWidth ? parseInt(settings.documentListWidth, 10) : 400
  }
}

/**
 * Save app settings
 */
export function saveAppSettings(settings: Partial<AppSettings>): void {
  const db = getDatabase()
  
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `)

  const saveMany = db.transaction((items: [string, string][]) => {
    for (const [key, value] of items) {
      upsert.run(key, value)
    }
  })

  const entries: [string, string][] = []
  
  if (settings.syncDirectory !== undefined) {
    entries.push(['syncDirectory', settings.syncDirectory])
  }
  if (settings.linebreak !== undefined) {
    entries.push(['linebreak', String(settings.linebreak)])
  }
  if (settings.latexcode !== undefined) {
    entries.push(['latexcode', String(settings.latexcode)])
  }
  if (settings.theme !== undefined) {
    entries.push(['theme', settings.theme])
  }
  if (settings.autoSyncInterval !== undefined) {
    entries.push(['autoSyncInterval', String(settings.autoSyncInterval)])
  }
  if (settings.autoSyncOnOpen !== undefined) {
    entries.push(['autoSyncOnOpen', String(settings.autoSyncOnOpen)])
  }
  if (settings.documentListWidth !== undefined) {
    entries.push(['documentListWidth', String(settings.documentListWidth)])
  }

  if (entries.length > 0) {
    saveMany(entries)
  }
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM settings').run()
  
  // Re-initialize with defaults
  const defaults: [string, string][] = [
    ['syncDirectory', ''],
    ['linebreak', 'true'],
    ['latexcode', 'false'],
    ['theme', 'system'],
    ['autoSyncInterval', '0']
  ]

  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
  const insertMany = db.transaction((items: [string, string][]) => {
    for (const [key, value] of items) {
      insert.run(key, value)
    }
  })

  insertMany(defaults)
}
