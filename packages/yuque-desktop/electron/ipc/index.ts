import type { IpcMain, BrowserWindow } from 'electron'
import { dialog } from 'electron'
import type { 
  IPCChannels, 
  AppSettings, 
  Session, 
  KnowledgeBase, 
  Document, 
  SyncStatus, 
  ChangeSet,
  SyncHistoryItem,
  FailedDocument
} from './types'
import {
  // Settings
  getAppSettings,
  saveAppSettings,
  // Books
  upsertBooks,
  getAllBooks,
  updateBookDocCount,
  // Documents
  upsertDocuments,
  getDocumentsByBookId,
  getDocumentsByStatus,
  updateDocumentSyncStatus,
  // Sync History
  getRecentSyncHistory
} from '../db/stores'
import type { BookInput, DocumentInput } from '../db/stores/types'
import {
  login as authLogin,
  logout as authLogout,
  getCurrentSession
} from '../services/auth'
import {
  getBookStacks,
  getDocsOfBook
} from '../services/books'
import {
  startSync,
  cancelSync,
  getSyncStatus,
  getChangesForBooks
} from '../services/sync'

/**
 * Register all IPC handlers
 * This function sets up the main process handlers for all IPC channels
 */
export function registerIpcHandlers(ipcMain: IpcMain, mainWindow?: BrowserWindow): void {
  // ============================================
  // Auth Handlers
  // ============================================
  
  ipcMain.handle('auth:login', async (_event, credentials: Parameters<IPCChannels['auth:login']>[0]) => {
    console.log('auth:login called with:', credentials.userName)
    const result = await authLogin(credentials.userName, credentials.password)
    return { success: result.success, error: result.error }
  })

  ipcMain.handle('auth:logout', async () => {
    console.log('auth:logout called')
    authLogout()
  })

  ipcMain.handle('auth:getSession', async (): Promise<Session | null> => {
    console.log('auth:getSession called')
    const session = getCurrentSession()
    if (!session) {
      return null
    }
    return {
      userId: session.userId,
      userName: session.userName,
      login: session.login,
      expiresAt: session.expiresAt
    }
  })

  // ============================================
  // Knowledge Base Handlers
  // ============================================

  ipcMain.handle('books:list', async (): Promise<KnowledgeBase[]> => {
    console.log('books:list called')
    try {
      // Fetch knowledge bases from Yuque API
      const books = await getBookStacks()
      
      // Store in Meta Store
      const bookInputs: BookInput[] = books.map((book) => ({
        id: book.id,
        slug: book.slug,
        name: book.name,
        userLogin: book.userLogin,
        type: book.type,
        docCount: book.docCount
      }))
      upsertBooks(bookInputs)
      
      console.log(`Fetched and stored ${books.length} knowledge bases`)
      return books
    } catch (error) {
      console.error('Failed to fetch books:', error)
      // If API fails, try to return cached data from Meta Store
      const cachedBooks = getAllBooks()
      if (cachedBooks.length > 0) {
        console.log(`Returning ${cachedBooks.length} cached books`)
        return cachedBooks.map((book) => ({
          id: book.id,
          slug: book.slug,
          name: book.name,
          userLogin: book.user_login,
          type: book.type,
          docCount: book.doc_count
        }))
      }
      throw error
    }
  })

  ipcMain.handle('books:getDocs', async (_event, bookId: string): Promise<Document[]> => {
    console.log('books:getDocs called for:', bookId)
    try {
      // Fetch documents from Yuque API
      const docs = await getDocsOfBook(bookId)
      
      // Check existing documents in Meta Store to preserve sync status
      const existingDocs = getDocumentsByBookId(bookId)
      const existingDocsMap = new Map(existingDocs.map((d) => [d.id, d]))
      
      // Log existing failed documents
      const failedDocs = existingDocs.filter(d => d.sync_status === 'failed')
      console.log(`[books:getDocs] Found ${failedDocs.length} failed documents in local DB:`, 
        failedDocs.map(d => ({ id: d.id, title: d.title, status: d.sync_status })))
      
      // Prepare document inputs, preserving existing sync status where applicable
      const docInputs: DocumentInput[] = docs.map((doc) => {
        const existing = existingDocsMap.get(doc.id)
        let syncStatus: 'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed' = 'new'
        
        if (existing) {
          // Document exists locally
          if (existing.sync_status === 'failed') {
            // Preserve failed status - don't retry automatically
            syncStatus = 'failed'
            console.log(`[books:getDocs] Preserving failed status for doc: ${doc.title} (id: ${doc.id})`)
          } else if (existing.sync_status === 'synced') {
            // Check if remote has been updated
            const remoteTime = new Date(doc.remoteUpdatedAt).getTime()
            const localTime = existing.local_synced_at 
              ? new Date(existing.local_synced_at).getTime() 
              : 0
            syncStatus = remoteTime > localTime ? 'modified' : 'synced'
          } else {
            // Preserve existing status (pending, new, deleted)
            syncStatus = existing.sync_status
          }
        }
        
        return {
          id: doc.id,
          bookId: doc.bookId,
          slug: doc.slug,
          title: doc.title,
          remoteUpdatedAt: doc.remoteUpdatedAt,
          localPath: existing?.local_path || undefined,
          localSyncedAt: existing?.local_synced_at || undefined,
          syncStatus
        }
      })
      
      // Log status summary before upsert
      const statusSummary = docInputs.reduce((acc, d) => {
        acc[d.syncStatus || 'unknown'] = (acc[d.syncStatus || 'unknown'] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log(`[books:getDocs] Status summary before upsert:`, statusSummary)
      
      // Store in Meta Store
      upsertDocuments(docInputs)
      
      // Update book document count
      updateBookDocCount(bookId, docs.length)
      
      console.log(`Fetched and stored ${docs.length} documents for book ${bookId}`)
      
      // Return documents with updated sync status
      return docInputs.map((doc) => ({
        id: doc.id,
        bookId: doc.bookId,
        slug: doc.slug,
        title: doc.title,
        localPath: doc.localPath,
        remoteUpdatedAt: doc.remoteUpdatedAt || '',
        localSyncedAt: doc.localSyncedAt,
        syncStatus: doc.syncStatus || 'new'
      }))
    } catch (error) {
      console.error('Failed to fetch docs:', error)
      // If API fails, try to return cached data from Meta Store
      const cachedDocs = getDocumentsByBookId(bookId)
      if (cachedDocs.length > 0) {
        console.log(`Returning ${cachedDocs.length} cached documents`)
        return cachedDocs.map((doc) => ({
          id: doc.id,
          bookId: doc.book_id,
          slug: doc.slug,
          title: doc.title,
          localPath: doc.local_path || undefined,
          remoteUpdatedAt: doc.remote_updated_at || '',
          localSyncedAt: doc.local_synced_at || undefined,
          syncStatus: doc.sync_status
        }))
      }
      throw error
    }
  })

  // ============================================
  // Sync Handlers
  // ============================================

  ipcMain.handle('sync:start', async (_event, options: Parameters<IPCChannels['sync:start']>[0]) => {
    console.log('sync:start called with:', options)
    
    // Build book info map for sync
    const books = getAllBooks()
    const bookInfoMap = new Map<string, { userLogin: string; slug: string; name: string }>()
    for (const book of books) {
      bookInfoMap.set(book.id, {
        userLogin: book.user_login,
        slug: book.slug,
        name: book.name
      })
    }

    // Start sync with progress callback
    const result = await startSync(options, bookInfoMap, (progress) => {
      // Send progress to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync:progress', progress)
      }
    })

    // Send completion event
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (result.success) {
        mainWindow.webContents.send('sync:complete', result)
      } else {
        mainWindow.webContents.send('sync:error', {
          message: result.errors?.join('\n') || '同步失败'
        })
      }
    }

    return result
  })

  ipcMain.handle('sync:cancel', async () => {
    console.log('sync:cancel called')
    cancelSync()
  })

  ipcMain.handle('sync:getStatus', async (): Promise<SyncStatus> => {
    console.log('sync:getStatus called')
    const status = getSyncStatus()
    return {
      isRunning: status.isRunning
    }
  })

  ipcMain.handle('sync:getChanges', async (_event, bookIds: string[]): Promise<ChangeSet> => {
    console.log('sync:getChanges called for:', bookIds)
    try {
      return await getChangesForBooks(bookIds)
    } catch (error) {
      console.error('Failed to get changes:', error)
      return { new: [], modified: [], deleted: [] }
    }
  })

  ipcMain.handle('sync:getHistory', async (_event, limit?: number): Promise<SyncHistoryItem[]> => {
    console.log('sync:getHistory called with limit:', limit)
    const history = getRecentSyncHistory(limit || 50)
    return history.map((record) => ({
      id: record.id,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      status: record.status,
      totalDocs: record.total_docs,
      syncedDocs: record.synced_docs,
      failedDocs: record.failed_docs,
      errorMessage: record.error_message
    }))
  })

  ipcMain.handle('sync:getFailedDocs', async (): Promise<FailedDocument[]> => {
    console.log('sync:getFailedDocs called')
    const failedDocs = getDocumentsByStatus('failed')
    const allBooks = getAllBooks()
    const booksMap = new Map(allBooks.map(b => [b.id, b]))
    
    return failedDocs.map((doc) => {
      const book = booksMap.get(doc.book_id)
      return {
        id: doc.id,
        bookId: doc.book_id,
        bookName: book?.name || '未知知识库',
        slug: doc.slug,
        title: doc.title,
        updatedAt: doc.updated_at
      }
    })
  })

  ipcMain.handle('sync:retryFailedDoc', async (_event, docId: string): Promise<void> => {
    console.log('sync:retryFailedDoc called for:', docId)
    // Reset status to 'new' so it will be picked up in next sync
    updateDocumentSyncStatus(docId, 'new')
  })

  ipcMain.handle('sync:clearFailedDoc', async (_event, docId: string): Promise<void> => {
    console.log('sync:clearFailedDoc called for:', docId)
    // Mark as deleted to skip in future syncs
    updateDocumentSyncStatus(docId, 'deleted')
  })

  // ============================================
  // Settings Handlers
  // ============================================

  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    console.log('settings:get called')
    return getAppSettings()
  })

  ipcMain.handle('settings:set', async (_event, settings: Partial<AppSettings>) => {
    console.log('settings:set called with:', settings)
    saveAppSettings(settings)
  })

  ipcMain.handle('settings:selectDirectory', async (): Promise<string | null> => {
    console.log('settings:selectDirectory called')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择同步目录',
      buttonLabel: '选择'
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  })
}
