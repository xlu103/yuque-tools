// ============================================
// Data Models
// ============================================

export interface LoginCredentials {
  userName: string
  password: string
}

export interface LoginResult {
  success: boolean
  error?: string
}

export interface Session {
  userId: string
  userName: string
  login: string
  expiresAt: number // Unix timestamp
}

export interface KnowledgeBase {
  id: string
  slug: string
  name: string
  userLogin: string
  type: 'owner' | 'collab'
  docCount: number
}

export interface Document {
  id: string
  bookId: string
  slug: string
  title: string
  localPath?: string
  remoteCreatedAt?: string
  remoteUpdatedAt: string
  localSyncedAt?: string
  syncStatus: 'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed'
}

export interface SyncOptions {
  bookIds?: string[]
  documentIds?: string[]
  force?: boolean
}

export interface SyncStatus {
  isRunning: boolean
  currentBookId?: string
  currentDocId?: string
  progress?: SyncProgress
}

export interface SyncProgress {
  current: number
  total: number
  currentDoc: string
  status: 'downloading' | 'writing' | 'comparing'
}

export interface SyncResult {
  success: boolean
  totalDocs: number
  syncedDocs: number
  failedDocs: number
  errors?: string[]
}

export interface ChangeSet {
  new: Document[]
  modified: Document[]
  deleted: Document[]
}

export interface AppSettings {
  syncDirectory: string
  linebreak: boolean
  latexcode: boolean
  theme: 'system' | 'light' | 'dark'
  autoSyncInterval: 0 | 30 | 60 | 720 | 1440 // 0 = disabled, others in minutes
}

export interface SyncHistoryItem {
  id: number
  startedAt: string
  completedAt: string | null
  status: 'running' | 'success' | 'failed' | 'cancelled'
  totalDocs: number
  syncedDocs: number
  failedDocs: number
  errorMessage: string | null
}

// ============================================
// IPC Channel Definitions
// ============================================

/**
 * IPC channels for invoke/handle pattern (renderer -> main)
 */
export interface IPCChannels {
  // Auth
  'auth:login': (credentials: LoginCredentials) => Promise<LoginResult>
  'auth:logout': () => Promise<void>
  'auth:getSession': () => Promise<Session | null>

  // Knowledge Bases
  'books:list': () => Promise<KnowledgeBase[]>
  'books:getDocs': (bookId: string) => Promise<Document[]>

  // Sync
  'sync:start': (options: SyncOptions) => Promise<SyncResult>
  'sync:cancel': () => Promise<void>
  'sync:getStatus': () => Promise<SyncStatus>
  'sync:getChanges': (bookIds: string[]) => Promise<ChangeSet>
  'sync:getHistory': (limit?: number) => Promise<SyncHistoryItem[]>

  // Settings
  'settings:get': () => Promise<AppSettings>
  'settings:set': (settings: Partial<AppSettings>) => Promise<void>
  'settings:selectDirectory': () => Promise<string | null>
}

/**
 * IPC event channels for send/on pattern (main -> renderer)
 */
export interface IPCEventChannels {
  'sync:progress': SyncProgress
  'sync:complete': SyncResult
  'sync:error': { message: string; code?: string }
}

// ============================================
// Type Helpers
// ============================================

export type IPCChannelName = keyof IPCChannels
export type IPCEventChannelName = keyof IPCEventChannels
