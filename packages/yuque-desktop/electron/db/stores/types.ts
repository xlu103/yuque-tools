/**
 * Database Store Types
 * Type definitions for database operations
 */

// ============================================
// Book Types
// ============================================

export interface BookRecord {
  id: string
  slug: string
  name: string
  user_login: string
  type: 'owner' | 'collab'
  doc_count: number
  created_at: string
  updated_at: string
}

export interface BookInput {
  id: string
  slug: string
  name: string
  userLogin: string
  type: 'owner' | 'collab'
  docCount: number
}

// ============================================
// Document Types
// ============================================

export interface DocumentRecord {
  id: string
  book_id: string
  slug: string
  title: string
  local_path: string | null
  remote_updated_at: string | null
  local_synced_at: string | null
  sync_status: 'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed'
  created_at: string
  updated_at: string
}

export interface DocumentInput {
  id: string
  bookId: string
  slug: string
  title: string
  localPath?: string
  remoteUpdatedAt?: string
  localSyncedAt?: string
  syncStatus?: 'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed'
}

export interface DocumentUpdate {
  localPath?: string
  remoteUpdatedAt?: string
  localSyncedAt?: string
  syncStatus?: 'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed'
}

// ============================================
// Sync History Types
// ============================================

export interface SyncHistoryRecord {
  id: number
  started_at: string
  completed_at: string | null
  status: 'running' | 'success' | 'failed' | 'cancelled'
  total_docs: number
  synced_docs: number
  failed_docs: number
  error_message: string | null
}

export interface SyncHistoryInput {
  totalDocs?: number
}

export interface SyncHistoryUpdate {
  completedAt?: string
  status?: 'running' | 'success' | 'failed' | 'cancelled'
  syncedDocs?: number
  failedDocs?: number
  errorMessage?: string
}

// ============================================
// Settings Types
// ============================================

export interface SettingsRecord {
  key: string
  value: string
  updated_at: string
}

export interface AppSettings {
  syncDirectory: string
  linebreak: boolean
  latexcode: boolean
  theme: 'system' | 'light' | 'dark'
  autoSyncInterval: 0 | 30 | 60 | 720 | 1440 // 0 = disabled, others in minutes
}


// ============================================
// Sync Session Types (断点续传)
// ============================================

export interface SyncSessionRecord {
  id: number
  book_ids: string  // JSON array
  total_docs: number
  completed_doc_ids: string  // JSON array
  status: 'running' | 'interrupted' | 'completed'
  started_at: string
  updated_at: string
}

export interface SyncSessionInput {
  bookIds: string[]
  totalDocs: number
}

export interface SyncSessionUpdate {
  completedDocIds?: string[]
  status?: 'running' | 'interrupted' | 'completed'
}

// ============================================
// Resource Types (图片和附件)
// ============================================

export interface ResourceRecord {
  id: number
  doc_id: string
  type: 'image' | 'attachment'
  remote_url: string
  local_path: string | null
  filename: string | null
  size_bytes: number | null
  status: 'pending' | 'downloaded' | 'failed'
  created_at: string
}

export interface ResourceInput {
  docId: string
  type: 'image' | 'attachment'
  remoteUrl: string
  localPath?: string
  filename?: string
  sizeBytes?: number
  status?: 'pending' | 'downloaded' | 'failed'
}

export interface ResourceUpdate {
  localPath?: string
  filename?: string
  sizeBytes?: number
  status?: 'pending' | 'downloaded' | 'failed'
}
