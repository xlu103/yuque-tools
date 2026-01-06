/**
 * Database Module - Meta Store
 * Manages SQLite database for document metadata, sync history, and settings
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { CREATE_TABLES_SQL, SCHEMA_VERSION, DEFAULT_SETTINGS } from './schema'

let db: Database.Database | null = null

/**
 * Get the database file path
 * Uses Electron's userData directory for persistent storage
 */
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  
  // Ensure directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  
  return join(dbDir, 'yuque-meta.db')
}

/**
 * Initialize the database connection and create tables
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = getDatabasePath()
  console.log('Initializing database at:', dbPath)

  db = new Database(dbPath)
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON')
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL')

  // Run migrations
  runMigrations(db)

  return db
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  // Check current schema version
  const versionTable = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  ).get()

  let currentVersion = 0
  
  if (versionTable) {
    const row = database.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
    currentVersion = row?.version ?? 0
  }

  console.log('Current schema version:', currentVersion)

  if (currentVersion < SCHEMA_VERSION) {
    console.log('Running migrations to version:', SCHEMA_VERSION)
    
    // Run all table creation in a transaction
    database.exec(CREATE_TABLES_SQL)
    
    // Initialize default settings if not exists
    initializeDefaultSettings(database)
    
    // Update schema version
    database.prepare(
      'INSERT OR REPLACE INTO schema_version (version) VALUES (?)'
    ).run(SCHEMA_VERSION)
    
    console.log('Migration completed')
  }
}

/**
 * Initialize default settings
 */
function initializeDefaultSettings(database: Database.Database): void {
  const insertSetting = database.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )

  const insertMany = database.transaction((settings: Record<string, string>) => {
    for (const [key, value] of Object.entries(settings)) {
      insertSetting.run(key, value)
    }
  })

  insertMany(DEFAULT_SETTINGS)
}

// Re-export types
export type { Database } from 'better-sqlite3'
