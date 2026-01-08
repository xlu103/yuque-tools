/**
 * Database Module - Meta Store
 * Manages SQLite database for document metadata, sync history, and settings
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { CREATE_TABLES_SQL, SCHEMA_VERSION, DEFAULT_SETTINGS, MIGRATION_V3_SQL, MIGRATION_V4_SQL } from './schema'

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
    console.log('Running migrations from version', currentVersion, 'to', SCHEMA_VERSION)
    
    // For fresh install, run all table creation
    if (currentVersion === 0) {
      database.exec(CREATE_TABLES_SQL)
    } else {
      // Run incremental migrations
      if (currentVersion < 3) {
        console.log('Running migration to v3: adding failed status')
        try {
          database.exec(MIGRATION_V3_SQL)
        } catch (error) {
          console.error('Migration v3 failed:', error)
          // If migration fails, the table might already have the new schema
        }
      }
      if (currentVersion < 4) {
        console.log('Running migration to v4: adding sync_sessions and resources tables')
        try {
          database.exec(MIGRATION_V4_SQL)
        } catch (error) {
          console.error('Migration v4 failed:', error)
        }
      }
      if (currentVersion < 5) {
        console.log('Running migration to v5: adding document hierarchy fields')
        try {
          // Check if columns already exist
          const columns = database.prepare("PRAGMA table_info(documents)").all() as any[]
          const columnNames = columns.map(c => c.name)
          
          // Only add columns that don't exist
          if (!columnNames.includes('uuid')) {
            database.exec('ALTER TABLE documents ADD COLUMN uuid TEXT;')
          }
          if (!columnNames.includes('parent_uuid')) {
            database.exec('ALTER TABLE documents ADD COLUMN parent_uuid TEXT;')
          }
          if (!columnNames.includes('child_uuid')) {
            database.exec('ALTER TABLE documents ADD COLUMN child_uuid TEXT;')
          }
          if (!columnNames.includes('doc_type')) {
            database.exec('ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT \'DOC\';')
          }
          if (!columnNames.includes('depth')) {
            database.exec('ALTER TABLE documents ADD COLUMN depth INTEGER DEFAULT 0;')
          }
          if (!columnNames.includes('sort_order')) {
            database.exec('ALTER TABLE documents ADD COLUMN sort_order INTEGER DEFAULT 0;')
          }
          
          // Create indexes
          database.exec('CREATE INDEX IF NOT EXISTS idx_documents_parent_uuid ON documents(parent_uuid);')
          database.exec('CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);')
          
          console.log('Migration v5 completed successfully')
        } catch (error) {
          console.error('Migration v5 failed:', error)
        }
      }
    }
    
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
