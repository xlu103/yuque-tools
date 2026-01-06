/**
 * Sync Engine Service
 * Handles incremental sync logic for documents
 * Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 7.1, 7.2, 7.3
 */

import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { getValidSession } from '../db/stores/auth'
import {
  getDocumentsByBookId,
  upsertDocument,
  updateDocumentSyncStatus
} from '../db/stores/documents'
import {
  createSyncHistory,
  updateSyncHistory,
  completeSyncHistorySuccess,
  completeSyncHistoryFailed,
  cancelSyncHistory
} from '../db/stores/syncHistory'
import { getAppSettings } from '../db/stores/settings'
import type { Document, ChangeSet, SyncProgress, SyncResult, SyncOptions } from '../ipc/types'
import type { DocumentRecord } from '../db/stores/types'

// Yuque API configuration
const YUQUE_CONFIG = {
  host: 'https://www.yuque.com',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G81 YuqueMobileApp/1.0.2 (AppBuild/650 Device/Phone Locale/zh-cn Theme/light YuqueType/public)'
}

// Sync state
let isSyncing = false
let shouldCancel = false
let currentSyncHistoryId: number | null = null

// Progress callback type
type ProgressCallback = (progress: SyncProgress) => void

/**
 * Compare timestamps to determine if remote is newer
 * Returns true if remote is newer than local
 */
export function isRemoteNewer(remoteUpdatedAt: string, localSyncedAt: string | null): boolean {
  if (!localSyncedAt) {
    return true
  }
  const remoteTime = new Date(remoteUpdatedAt).getTime()
  const localTime = new Date(localSyncedAt).getTime()
  return remoteTime > localTime
}

/**
 * Determine sync status for a document based on local and remote state
 * Requirements: 4.1, 4.2, 4.4
 */
export function determineSyncStatus(
  remoteDoc: { id: string; remoteUpdatedAt: string },
  localDoc: DocumentRecord | undefined
): 'new' | 'modified' | 'synced' {
  // Document doesn't exist locally - it's new
  if (!localDoc) {
    return 'new'
  }

  // Document exists locally - check if modified
  if (localDoc.sync_status === 'synced') {
    // Check if remote has been updated since last sync
    if (isRemoteNewer(remoteDoc.remoteUpdatedAt, localDoc.local_synced_at)) {
      return 'modified'
    }
    return 'synced'
  }

  // If local status is 'new', 'pending', or 'modified', keep checking remote
  if (isRemoteNewer(remoteDoc.remoteUpdatedAt, localDoc.local_synced_at)) {
    return 'modified'
  }

  // If local is 'new' but remote hasn't changed, it's still new
  if (localDoc.sync_status === 'new') {
    return 'new'
  }

  return localDoc.sync_status === 'deleted' ? 'synced' : (localDoc.sync_status as 'synced' | 'modified')
}

/**
 * Detect changes between remote documents and local Meta Store
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
export function detectChanges(
  remoteDocs: Document[],
  localDocs: DocumentRecord[]
): ChangeSet {
  const localDocsMap = new Map(localDocs.map(d => [d.id, d]))
  const remoteDocIds = new Set(remoteDocs.map(d => d.id))

  const changeSet: ChangeSet = {
    new: [],
    modified: [],
    deleted: []
  }

  // Check each remote document
  for (const remoteDoc of remoteDocs) {
    const localDoc = localDocsMap.get(remoteDoc.id)
    const status = determineSyncStatus(remoteDoc, localDoc)

    const doc: Document = {
      id: remoteDoc.id,
      bookId: remoteDoc.bookId,
      slug: remoteDoc.slug,
      title: remoteDoc.title,
      localPath: localDoc?.local_path || undefined,
      remoteUpdatedAt: remoteDoc.remoteUpdatedAt,
      localSyncedAt: localDoc?.local_synced_at || undefined,
      syncStatus: status
    }

    if (status === 'new') {
      changeSet.new.push(doc)
    } else if (status === 'modified') {
      changeSet.modified.push(doc)
    }
  }

  // Check for deleted documents (exist locally but not remotely)
  // Requirements: 4.5
  for (const localDoc of localDocs) {
    if (!remoteDocIds.has(localDoc.id) && localDoc.sync_status !== 'deleted') {
      changeSet.deleted.push({
        id: localDoc.id,
        bookId: localDoc.book_id,
        slug: localDoc.slug,
        title: localDoc.title,
        localPath: localDoc.local_path || undefined,
        remoteUpdatedAt: localDoc.remote_updated_at || '',
        localSyncedAt: localDoc.local_synced_at || undefined,
        syncStatus: 'deleted'
      })
    }
  }

  return changeSet
}

/**
 * Get changes for specified books
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
export async function getChangesForBooks(bookIds: string[]): Promise<ChangeSet> {
  const allChanges: ChangeSet = {
    new: [],
    modified: [],
    deleted: []
  }

  for (const bookId of bookIds) {
    // Get local documents from Meta Store
    const localDocs = getDocumentsByBookId(bookId)

    // Fetch remote documents
    const remoteDocs = await fetchRemoteDocs(bookId)

    // Detect changes
    const changes = detectChanges(remoteDocs, localDocs)

    allChanges.new.push(...changes.new)
    allChanges.modified.push(...changes.modified)
    allChanges.deleted.push(...changes.deleted)
  }

  return allChanges
}

/**
 * Fetch remote documents for a book
 */
async function fetchRemoteDocs(bookId: string): Promise<Document[]> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  const response = await axios({
    url: `${YUQUE_CONFIG.host}/api/docs?book_id=${bookId}`,
    method: 'get',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': YUQUE_CONFIG.userAgent,
      cookie: session.cookies
    }
  })

  const docsData = response.data?.data || []

  return docsData.map((doc: any) => ({
    id: String(doc.id),
    bookId: bookId,
    slug: doc.slug,
    title: doc.title,
    remoteUpdatedAt: doc.content_updated_at || doc.updated_at || new Date().toISOString(),
    syncStatus: 'new' as const
  }))
}

/**
 * Download markdown content for a document
 */
async function downloadDocumentContent(
  userLogin: string,
  bookSlug: string,
  docSlug: string,
  linebreak: boolean,
  latexcode: boolean
): Promise<string> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  const url = `${YUQUE_CONFIG.host}/${userLogin}/${bookSlug}/${docSlug}/markdown?attachment=true&latexcode=${latexcode}&anchor=false&linebreak=${linebreak}`

  const response = await axios({
    url,
    method: 'get',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': YUQUE_CONFIG.userAgent,
      cookie: session.cookies
    }
  })

  return response.data
}

/**
 * Write document content to file
 */
function writeDocumentToFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, content, 'utf-8')
}

/**
 * Get sync status
 */
export function getSyncStatus() {
  return {
    isRunning: isSyncing,
    currentSyncHistoryId
  }
}

/**
 * Cancel ongoing sync
 */
export function cancelSync(): void {
  if (isSyncing) {
    shouldCancel = true
    if (currentSyncHistoryId) {
      cancelSyncHistory(currentSyncHistoryId)
    }
  }
}

/**
 * Start incremental sync
 * Requirements: 4.2, 4.6, 7.1, 7.2, 7.3
 */
export async function startSync(
  options: SyncOptions,
  bookInfoMap: Map<string, { userLogin: string; slug: string }>,
  onProgress?: ProgressCallback
): Promise<SyncResult> {
  if (isSyncing) {
    return {
      success: false,
      totalDocs: 0,
      syncedDocs: 0,
      failedDocs: 0,
      errors: ['同步正在进行中']
    }
  }

  isSyncing = true
  shouldCancel = false

  const settings = getAppSettings()
  const syncDirectory = settings.syncDirectory || process.cwd()
  const linebreak = settings.linebreak
  const latexcode = settings.latexcode

  const errors: string[] = []
  let syncedDocs = 0
  let failedDocs = 0

  try {
    // Get changes for all specified books
    const bookIds = options.bookIds || []
    if (bookIds.length === 0) {
      return {
        success: false,
        totalDocs: 0,
        syncedDocs: 0,
        failedDocs: 0,
        errors: ['未指定知识库']
      }
    }

    // Detect changes
    const changes = await getChangesForBooks(bookIds)

    // Determine which documents to sync
    let docsToSync: Document[] = []

    if (options.force) {
      // Force sync: re-download all documents
      for (const bookId of bookIds) {
        const localDocs = getDocumentsByBookId(bookId)
        for (const doc of localDocs) {
          if (doc.sync_status !== 'deleted') {
            docsToSync.push({
              id: doc.id,
              bookId: doc.book_id,
              slug: doc.slug,
              title: doc.title,
              localPath: doc.local_path || undefined,
              remoteUpdatedAt: doc.remote_updated_at || '',
              localSyncedAt: doc.local_synced_at || undefined,
              syncStatus: doc.sync_status
            })
          }
        }
        // Also include new documents from remote
        docsToSync.push(...changes.new.filter(d => d.bookId === bookId))
      }
      // Remove duplicates
      const seen = new Set<string>()
      docsToSync = docsToSync.filter(d => {
        if (seen.has(d.id)) return false
        seen.add(d.id)
        return true
      })
    } else {
      // Incremental sync: only new and modified documents
      docsToSync = [...changes.new, ...changes.modified]
    }

    // Filter by specific document IDs if provided
    if (options.documentIds && options.documentIds.length > 0) {
      const docIdSet = new Set(options.documentIds)
      docsToSync = docsToSync.filter(d => docIdSet.has(d.id))
    }

    const totalDocs = docsToSync.length

    // Create sync history record
    // Requirements: 7.1
    currentSyncHistoryId = createSyncHistory({ totalDocs })

    // Mark deleted documents
    // Requirements: 4.5
    for (const deletedDoc of changes.deleted) {
      updateDocumentSyncStatus(deletedDoc.id, 'deleted')
    }

    // Download and save each document
    for (let i = 0; i < docsToSync.length; i++) {
      if (shouldCancel) {
        break
      }

      const doc = docsToSync[i]
      const bookInfo = bookInfoMap.get(doc.bookId)

      if (!bookInfo) {
        errors.push(`知识库信息未找到: ${doc.bookId}`)
        failedDocs++
        continue
      }

      // Send progress event
      // Requirements: 4.6
      if (onProgress) {
        onProgress({
          current: i,
          total: totalDocs,
          currentDoc: doc.title,
          status: 'downloading'
        })
      }

      try {
        // Download content
        const content = await downloadDocumentContent(
          bookInfo.userLogin,
          bookInfo.slug,
          doc.slug,
          linebreak,
          latexcode
        )

        if (shouldCancel) break

        // Send writing progress
        if (onProgress) {
          onProgress({
            current: i,
            total: totalDocs,
            currentDoc: doc.title,
            status: 'writing'
          })
        }

        // Sanitize filename
        const sanitizedTitle = doc.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        const filePath = path.join(syncDirectory, bookInfo.slug, `${sanitizedTitle}.md`)

        // Write to file
        writeDocumentToFile(filePath, content)

        // Update Meta Store
        const now = new Date().toISOString()
        upsertDocument({
          id: doc.id,
          bookId: doc.bookId,
          slug: doc.slug,
          title: doc.title,
          localPath: filePath,
          remoteUpdatedAt: doc.remoteUpdatedAt,
          localSyncedAt: now,
          syncStatus: 'synced'
        })

        syncedDocs++

        // Update sync history progress
        if (currentSyncHistoryId) {
          updateSyncHistory(currentSyncHistoryId, { syncedDocs })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`下载失败 [${doc.title}]: ${errorMsg}`)
        failedDocs++

        // Update failed count in history
        if (currentSyncHistoryId) {
          updateSyncHistory(currentSyncHistoryId, { failedDocs })
        }
      }
    }

    // Final progress
    if (onProgress) {
      onProgress({
        current: totalDocs,
        total: totalDocs,
        currentDoc: '',
        status: 'comparing'
      })
    }

    // Complete sync history
    // Requirements: 7.2, 7.3
    if (currentSyncHistoryId) {
      if (shouldCancel) {
        cancelSyncHistory(currentSyncHistoryId, syncedDocs)
      } else if (errors.length > 0) {
        completeSyncHistoryFailed(
          currentSyncHistoryId,
          errors.join('\n'),
          syncedDocs,
          failedDocs
        )
      } else {
        completeSyncHistorySuccess(currentSyncHistoryId, syncedDocs)
      }
    }

    return {
      success: errors.length === 0 && !shouldCancel,
      totalDocs,
      syncedDocs,
      failedDocs,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    // Record failure in sync history
    if (currentSyncHistoryId) {
      completeSyncHistoryFailed(currentSyncHistoryId, errorMsg, syncedDocs, failedDocs)
    }

    return {
      success: false,
      totalDocs: 0,
      syncedDocs,
      failedDocs,
      errors: [errorMsg]
    }
  } finally {
    isSyncing = false
    shouldCancel = false
    currentSyncHistoryId = null
  }
}
