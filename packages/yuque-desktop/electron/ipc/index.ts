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
  FailedDocument,
  FileOperationResult,
  OpenInYuqueParams,
  SearchOptions,
  SearchResult,
  InterruptedSession,
  SyncStatistics
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
  getDocsOfBook,
  loadMoreNotes,
  getAllNotesForSync
} from '../services/books'
import {
  startSync,
  cancelSync,
  getSyncStatus,
  getChangesForBooks,
  getInterruptedSyncSession,
  clearInterruptedSession
} from '../services/sync'
import {
  openFile,
  openInYuque,
  showInFolder,
  readFileContent
} from '../services/fileManager'
import { searchService } from '../services/search'
import { getStatistics } from '../services/statistics'

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
      
      // Store in Meta Store (exclude notes virtual book)
      const bookInputs: BookInput[] = books
        .filter((book) => book.id !== '__notes__')
        .map((book) => ({
          id: book.id,
          slug: book.slug,
          name: book.name,
          userLogin: book.userLogin,
          type: book.type,
          docCount: book.docCount
        }))
      upsertBooks(bookInputs)
      
      console.log(`Fetched and stored ${bookInputs.length} knowledge bases (plus notes)`)
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

  // Get local cached documents (no network request)
  ipcMain.handle('books:getLocalDocs', async (_event, bookId: string): Promise<Document[]> => {
    console.log('books:getLocalDocs called for:', bookId)
    const cachedDocs = getDocumentsByBookId(bookId)
    console.log(`[books:getLocalDocs] Found ${cachedDocs.length} cached documents`)
    
    return cachedDocs.map((doc) => ({
      id: doc.id,
      bookId: doc.book_id,
      slug: doc.slug,
      title: doc.title,
      uuid: doc.uuid || undefined,
      parentUuid: doc.parent_uuid || undefined,
      childUuid: doc.child_uuid || undefined,
      docType: doc.doc_type || 'DOC',
      depth: doc.depth || 0,
      sortOrder: doc.sort_order || 0,
      localPath: doc.local_path || undefined,
      remoteUpdatedAt: doc.remote_updated_at || '',
      localSyncedAt: doc.local_synced_at || undefined,
      syncStatus: doc.sync_status
    }))
  })

  ipcMain.handle('books:getDocs', async (_event, bookId: string): Promise<Document[]> => {
    console.log('books:getDocs called for:', bookId)
    try {
      // Get book info from database to pass to getDocsOfBook
      let bookInfo: { userLogin: string; slug: string } | undefined
      
      if (bookId !== '__notes__') {
        const books = getAllBooks()
        const book = books.find(b => b.id === bookId)
        if (book) {
          bookInfo = {
            userLogin: book.user_login,
            slug: book.slug
          }
          console.log(`[books:getDocs] Found book info: ${bookInfo.userLogin}/${bookInfo.slug}`)
        }
      }
      
      // Fetch documents from Yuque API (with hierarchy if possible)
      const docs = await getDocsOfBook(bookId, bookInfo)
      
      // Check existing documents in Meta Store to preserve sync status
      const existingDocs = getDocumentsByBookId(bookId)
      const existingDocsMap = new Map(existingDocs.map((d) => [d.id, d]))
      
      // For notes, we don't preserve failed status - allow retry
      const isNotesBook = bookId === '__notes__'
      
      // Log existing failed documents
      const failedDocs = existingDocs.filter(d => d.sync_status === 'failed')
      if (failedDocs.length > 0) {
        console.log(`[books:getDocs] Found ${failedDocs.length} failed documents in local DB`)
        if (isNotesBook) {
          console.log(`[books:getDocs] Notes book - will reset failed status to 'new' for retry`)
        }
      }
      
      // Map documents to DocumentInput format with preserved sync status
      const docsToStore: DocumentInput[] = docs.map((doc) => {
        const existing = existingDocsMap.get(doc.id)
        let syncStatus: 'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed' = 'new'
        let localPath: string | undefined = undefined
        let localSyncedAt: string | undefined = undefined
        
        if (existing) {
          // Preserve failed status for regular books, but reset for notes
          if (existing.sync_status === 'failed') {
            if (isNotesBook) {
              syncStatus = 'new'
              console.log(`[books:getDocs] Resetting failed note to 'new': ${doc.title} (id: ${doc.id})`)
            } else {
              syncStatus = 'failed'
              console.log(`[books:getDocs] Preserving failed status for doc: ${doc.title} (id: ${doc.id})`)
            }
          } else if (existing.sync_status === 'synced') {
            syncStatus = 'synced'
            // Preserve local path and sync time for synced documents
            localPath = existing.local_path || undefined
            localSyncedAt = existing.local_synced_at || undefined
          }
        }
        
        return {
          id: doc.id,
          bookId: doc.bookId,
          slug: doc.slug,
          title: doc.title,
          uuid: doc.uuid,
          parentUuid: doc.parentUuid,
          childUuid: doc.childUuid,
          docType: doc.docType,
          depth: doc.depth,
          sortOrder: doc.sortOrder,
          remoteUpdatedAt: doc.remoteUpdatedAt,
          localPath: localPath,
          localSyncedAt: localSyncedAt,
          syncStatus: syncStatus
        }
      })
      
      // Log status summary
      const statusSummary = docsToStore.reduce((acc, doc) => {
        acc[doc.syncStatus!] = (acc[doc.syncStatus!] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log(`[books:getDocs] Status summary before upsert:`, statusSummary)
      
      // For notes book, ensure it exists in books table first
      if (isNotesBook) {
        const books = getAllBooks()
        const notesBookExists = books.some(b => b.id === '__notes__')
        if (!notesBookExists) {
          console.log(`[books:getDocs] Creating notes book entry in database`)
          // Notes book should have been created by getBookStacks, but just in case
          upsertBooks([{
            id: '__notes__',
            slug: 'notes',
            name: '小记',
            userLogin: 'system',
            type: 'owner',
            docCount: docsToStore.length
          }])
        }
      }
      
      // Store in Meta Store
      upsertDocuments(docsToStore)
      console.log(`Fetched and stored ${docs.length} documents for book ${bookId}`)
      
      // Return documents with correct sync status and local path
      const result: Document[] = docsToStore.map(doc => ({
        id: doc.id,
        bookId: doc.bookId,
        slug: doc.slug,
        title: doc.title,
        uuid: doc.uuid || undefined,
        parentUuid: doc.parentUuid || undefined,
        childUuid: doc.childUuid || undefined,
        docType: doc.docType,
        depth: doc.depth,
        sortOrder: doc.sortOrder,
        remoteUpdatedAt: doc.remoteUpdatedAt || '',
        localPath: doc.localPath,
        localSyncedAt: doc.localSyncedAt,
        syncStatus: doc.syncStatus || 'new'
      }))
      
      return result
    } catch (error) {
      console.error('Failed to fetch docs:', error)
      throw error
    }
  })

  // ============================================
  // Notes Handlers (小记懒加载)
  // ============================================

  ipcMain.handle('notes:loadMore', async (_event, offset: number, limit?: number): Promise<{ notes: Document[]; hasMore: boolean }> => {
    console.log('notes:loadMore called with offset:', offset, 'limit:', limit)
    try {
      const result = await loadMoreNotes(offset, limit || 20)
      
      // Store in Meta Store
      const docInputs: DocumentInput[] = result.notes.map((doc) => ({
        id: doc.id,
        bookId: doc.bookId,
        slug: doc.slug,
        title: doc.title,
        remoteUpdatedAt: doc.remoteUpdatedAt,
        syncStatus: 'new'
      }))
      upsertDocuments(docInputs)
      
      return result
    } catch (error) {
      console.error('Failed to load more notes:', error)
      throw error
    }
  })

  ipcMain.handle('notes:getAllForSync', async (): Promise<Document[]> => {
    console.log('notes:getAllForSync called')
    try {
      const notes = await getAllNotesForSync()
      
      // Store in Meta Store
      const docInputs: DocumentInput[] = notes.map((doc) => ({
        id: doc.id,
        bookId: doc.bookId,
        slug: doc.slug,
        title: doc.title,
        remoteUpdatedAt: doc.remoteUpdatedAt,
        syncStatus: 'new'
      }))
      upsertDocuments(docInputs)
      
      console.log(`Fetched and stored ${notes.length} notes for sync`)
      return notes
    } catch (error) {
      console.error('Failed to get all notes for sync:', error)
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
    
    // Add notes book info (小记)
    const session = await getCurrentSession()
    if (session) {
      bookInfoMap.set('__notes__', {
        userLogin: session.login,
        slug: 'notes',
        name: '小记'
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

  // ============================================
  // File Operation Handlers
  // ============================================

  ipcMain.handle('file:open', async (_event, filePath: string): Promise<FileOperationResult> => {
    console.log('file:open called for:', filePath)
    return await openFile(filePath)
  })

  ipcMain.handle('file:openInYuque', async (_event, params: OpenInYuqueParams): Promise<FileOperationResult> => {
    console.log('file:openInYuque called with:', params)
    return await openInYuque(params.userLogin, params.bookSlug, params.docSlug)
  })

  ipcMain.handle('file:showInFolder', async (_event, filePath: string): Promise<FileOperationResult> => {
    console.log('file:showInFolder called for:', filePath)
    return await showInFolder(filePath)
  })

  ipcMain.handle('file:readContent', async (_event, filePath: string): Promise<{ success: boolean; content?: string; error?: string }> => {
    console.log('file:readContent called for:', filePath)
    return await readFileContent(filePath)
  })

  // 读取图片文件并返回 base64 数据
  ipcMain.handle('file:readImage', async (_event, filePath: string): Promise<{ success: boolean; dataUrl?: string; error?: string }> => {
    console.log('file:readImage called for:', filePath)
    try {
      const fs = await import('fs')
      const path = await import('path')
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }
      
      const buffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      
      // 根据扩展名确定 MIME 类型
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon'
      }
      
      const mimeType = mimeTypes[ext] || 'image/png'
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`
      
      return { success: true, dataUrl }
    } catch (error) {
      console.error('Failed to read image:', error)
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // Search Handlers
  // ============================================

  ipcMain.handle('search:query', async (_event, query: string, options?: SearchOptions): Promise<SearchResult[]> => {
    console.log('search:query called with:', query, options)
    try {
      const results = await searchService.search(query, options)
      return results
    } catch (error) {
      console.error('Search failed:', error)
      return []
    }
  })

  // ============================================
  // Resume Sync Handlers (断点续传)
  // ============================================

  ipcMain.handle('sync:getInterruptedSession', async (): Promise<InterruptedSession | null> => {
    console.log('sync:getInterruptedSession called')
    const session = getInterruptedSyncSession()
    if (!session) return null
    
    return {
      id: session.id,
      bookIds: session.bookIds,
      totalDocs: session.totalDocs,
      completedCount: session.completedDocIds.length,
      startedAt: session.startedAt
    }
  })

  ipcMain.handle('sync:clearInterruptedSession', async (_event, sessionId: number): Promise<void> => {
    console.log('sync:clearInterruptedSession called for:', sessionId)
    clearInterruptedSession(sessionId)
  })

  // ============================================
  // Statistics Handlers (统计)
  // ============================================

  ipcMain.handle('stats:get', async (): Promise<SyncStatistics> => {
    console.log('stats:get called')
    return getStatistics()
  })

  // ============================================
  // Window Handlers
  // ============================================

  ipcMain.handle('window:expandWidth', async (_event, additionalWidth: number): Promise<void> => {
    console.log('window:expandWidth called with:', additionalWidth)
    if (!mainWindow) return
    
    const [currentWidth, currentHeight] = mainWindow.getSize()
    const newWidth = currentWidth + additionalWidth
    mainWindow.setSize(newWidth, currentHeight, true)
  })
}
