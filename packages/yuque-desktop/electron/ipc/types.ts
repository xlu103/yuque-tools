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
  uuid?: string | null
  parentUuid?: string | null
  childUuid?: string | null
  docType?: 'DOC' | 'TITLE'
  depth?: number
  sortOrder?: number
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

export interface SingleDocSyncOptions {
  bookId: string
  docId: string
  force?: boolean
}

export interface SingleDocSyncResult {
  success: boolean
  localPath?: string
  error?: string
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
  autoSyncOnOpen: boolean // Auto sync when opening a knowledge base
  documentListWidth: number // Document list panel width (300-800)
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

export interface FailedDocument {
  id: string
  bookId: string
  bookName: string
  slug: string
  title: string
  updatedAt: string
}

export interface FileOperationResult {
  success: boolean
  error?: string
}

export interface OpenInYuqueParams {
  userLogin: string
  bookSlug: string
  docSlug: string
}

export interface SearchOptions {
  limit?: number
  bookId?: string
  searchContent?: boolean
}

export interface SearchResult {
  docId: string
  title: string
  bookId: string
  bookName: string
  snippet: string
  matchType: 'title' | 'content'
  localPath: string | null
}

export interface InterruptedSession {
  id: number
  bookIds: string[]
  totalDocs: number
  completedCount: number
  startedAt: string
}

export interface SyncStatistics {
  totalDocuments: number
  syncedDocuments: number
  failedDocuments: number
  pendingDocuments: number
  newDocuments: number
  modifiedDocuments: number
  deletedDocuments: number
  totalBooks: number
  totalStorageBytes: number
  lastSyncTime: string | null
  imageCount: number
  attachmentCount: number
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
  'books:getLocalDocs': (bookId: string) => Promise<Document[]>

  // Notes (小记)
  'notes:loadMore': (offset: number, limit?: number) => Promise<{ notes: Document[]; hasMore: boolean }>
  'notes:getAllForSync': () => Promise<Document[]>

  // Sync
  'sync:start': (options: SyncOptions) => Promise<SyncResult>
  'sync:singleDoc': (options: SingleDocSyncOptions) => Promise<SingleDocSyncResult>
  'sync:cancel': () => Promise<void>
  'sync:getStatus': () => Promise<SyncStatus>
  'sync:getChanges': (bookIds: string[]) => Promise<ChangeSet>
  'sync:getHistory': (limit?: number) => Promise<SyncHistoryItem[]>
  'sync:getFailedDocs': () => Promise<FailedDocument[]>
  'sync:retryFailedDoc': (docId: string) => Promise<void>
  'sync:clearFailedDoc': (docId: string) => Promise<void>
  'sync:resetAllData': () => Promise<{ documentsReset: number }>

  // Settings
  'settings:get': () => Promise<AppSettings>
  'settings:set': (settings: Partial<AppSettings>) => Promise<void>
  'settings:selectDirectory': () => Promise<string | null>

  // File operations
  'file:open': (filePath: string) => Promise<FileOperationResult>
  'file:openInYuque': (params: OpenInYuqueParams) => Promise<FileOperationResult>
  'file:showInFolder': (filePath: string) => Promise<FileOperationResult>
  'file:readContent': (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  'file:readImage': (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>

  // Search
  'search:query': (query: string, options?: SearchOptions) => Promise<SearchResult[]>

  // Resume sync (断点续传)
  'sync:getInterruptedSession': () => Promise<InterruptedSession | null>
  'sync:clearInterruptedSession': (sessionId: number) => Promise<void>

  // Statistics (统计)
  'stats:get': () => Promise<SyncStatistics>

  // Window operations
  'window:expandWidth': (additionalWidth: number) => Promise<void>
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
