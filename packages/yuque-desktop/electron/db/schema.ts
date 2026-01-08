/**
 * Database Schema Definitions
 * SQLite schema for Meta Store - stores document metadata, sync history, and settings
 */

export const SCHEMA_VERSION = 5

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
  uuid TEXT,
  parent_uuid TEXT,
  child_uuid TEXT,
  doc_type TEXT DEFAULT 'DOC' CHECK(doc_type IN ('DOC', 'TITLE')),
  depth INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
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

-- 同步会话 (Sync Sessions) - 用于断点续传
CREATE TABLE IF NOT EXISTS sync_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_ids TEXT NOT NULL,
  total_docs INTEGER DEFAULT 0,
  completed_doc_ids TEXT DEFAULT '[]',
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'interrupted', 'completed')),
  started_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 资源表 (Resources) - 图片和附件
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image', 'attachment')),
  remote_url TEXT NOT NULL,
  local_path TEXT,
  filename TEXT,
  size_bytes INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'downloaded', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_documents_parent_uuid ON documents(parent_uuid);
CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);
CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON sync_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_sessions_status ON sync_sessions(status);
CREATE INDEX IF NOT EXISTS idx_resources_doc_id ON resources(doc_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);

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
 * Migration SQL for version 4: Add sync_sessions and resources tables
 */
export const MIGRATION_V4_SQL = `
-- 同步会话表 (用于断点续传)
CREATE TABLE IF NOT EXISTS sync_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_ids TEXT NOT NULL,
  total_docs INTEGER DEFAULT 0,
  completed_doc_ids TEXT DEFAULT '[]',
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'interrupted', 'completed')),
  started_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 资源表 (图片和附件)
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image', 'attachment')),
  remote_url TEXT NOT NULL,
  local_path TEXT,
  filename TEXT,
  size_bytes INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'downloaded', 'failed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sync_sessions_status ON sync_sessions(status);
CREATE INDEX IF NOT EXISTS idx_resources_doc_id ON resources(doc_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
`

/**
 * Migration SQL for version 5: Add document hierarchy fields
 */
export const MIGRATION_V5_SQL = `
-- Add hierarchy fields to documents table (only if they don't exist)
-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we check first

-- Add uuid column
ALTER TABLE documents ADD COLUMN uuid TEXT;

-- Add parent_uuid column
ALTER TABLE documents ADD COLUMN parent_uuid TEXT;

-- Add child_uuid column
ALTER TABLE documents ADD COLUMN child_uuid TEXT;

-- Add doc_type column with default
ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT 'DOC';

-- Add depth column with default
ALTER TABLE documents ADD COLUMN depth INTEGER DEFAULT 0;

-- Add sort_order column with default
ALTER TABLE documents ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Create indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_documents_parent_uuid ON documents(parent_uuid);
CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);
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
