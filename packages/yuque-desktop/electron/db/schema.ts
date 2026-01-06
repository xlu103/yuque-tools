/**
 * Database Schema Definitions
 * SQLite schema for Meta Store - stores document metadata, sync history, and settings
 */

export const SCHEMA_VERSION = 3

/**
 * SQL statements to create all tables
 */
export const CREATE_TABLES_SQL = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

-- 知识库 (Knowledge Bases)
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  user_login TEXT NOT NULL,
  type TEXT DEFAULT 'owner' CHECK(type IN ('owner', 'collab')),
  doc_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 文档元数据 (Documents)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  local_path TEXT,
  remote_updated_at TEXT,
  local_synced_at TEXT,
  sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'modified', 'new', 'deleted', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- 同步历史 (Sync History)
CREATE TABLE IF NOT EXISTS sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'success', 'failed', 'cancelled')),
  total_docs INTEGER DEFAULT 0,
  synced_docs INTEGER DEFAULT 0,
  failed_docs INTEGER DEFAULT 0,
  error_message TEXT
);

-- 应用设置 (Settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_book_id ON documents(book_id);
CREATE INDEX IF NOT EXISTS idx_documents_sync_status ON documents(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON sync_history(started_at DESC);

-- 认证会话 (Auth Session)
CREATE TABLE IF NOT EXISTS auth_session (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  login TEXT NOT NULL,
  cookies TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`

/**
 * Migration SQL for version 3: Add 'failed' status to documents
 */
export const MIGRATION_V3_SQL = `
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table with the new constraint

-- Create new table with updated constraint
CREATE TABLE IF NOT EXISTS documents_new (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  local_path TEXT,
  remote_updated_at TEXT,
  local_synced_at TEXT,
  sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'modified', 'new', 'deleted', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO documents_new SELECT * FROM documents;

-- Drop old table
DROP TABLE documents;

-- Rename new table
ALTER TABLE documents_new RENAME TO documents;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_documents_book_id ON documents(book_id);
CREATE INDEX IF NOT EXISTS idx_documents_sync_status ON documents(sync_status);
`

/**
 * Default settings to initialize
 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  syncDirectory: '',
  linebreak: 'true',
  latexcode: 'false',
  theme: 'system',
  autoSyncInterval: '0'
}
