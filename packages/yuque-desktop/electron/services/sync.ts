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
import {
  getInterruptedSession,
  updateSyncSessionStatus,
  markRunningSessonsAsInterrupted
} from '../db/stores/syncSessions'
import { getAppSettings } from '../db/stores/settings'
import type { Document, ChangeSet, SyncProgress, SyncResult, SyncOptions } from '../ipc/types'
import type { DocumentRecord } from '../db/stores/types'
import { processDocumentImages } from './imageProcessor'
import { processDocumentAttachments } from './attachmentProcessor'
import { NOTES_BOOK_ID, getNotes, getCachedNoteContent } from './books'

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
let currentSyncSessionId: number | null = null

// Progress callback type
type ProgressCallback = (progress: SyncProgress) => void

/**
 * Sync session info for resume functionality
 */
export interface SyncSessionInfo {
  id: number
  bookIds: string[]
  totalDocs: number
  completedDocIds: string[]
  status: 'running' | 'interrupted' | 'completed'
  startedAt: string
  updatedAt: string
}

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
): 'new' | 'modified' | 'synced' | 'failed' {
  // Document doesn't exist locally - it's new
  if (!localDoc) {
    console.log(`[determineSyncStatus] Doc ${remoteDoc.id}: no local doc, status = new`)
    return 'new'
  }

  // If document previously failed, keep it as failed (skip in incremental sync)
  if (localDoc.sync_status === 'failed') {
    console.log(`[determineSyncStatus] Doc ${remoteDoc.id} (${localDoc.title}): local status is failed, keeping as failed`)
    return 'failed'
  }

  // Document exists locally - check if modified
  if (localDoc.sync_status === 'synced') {
    // Check if remote has been updated since last sync
    if (isRemoteNewer(remoteDoc.remoteUpdatedAt, localDoc.local_synced_at)) {
      console.log(`[determineSyncStatus] Doc ${remoteDoc.id} (${localDoc.title}): remote newer, status = modified`)
      return 'modified'
    }
    console.log(`[determineSyncStatus] Doc ${remoteDoc.id} (${localDoc.title}): already synced`)
    return 'synced'
  }

  // If local status is 'new', 'pending', or 'modified', keep checking remote
  if (isRemoteNewer(remoteDoc.remoteUpdatedAt, localDoc.local_synced_at)) {
    console.log(`[determineSyncStatus] Doc ${remoteDoc.id} (${localDoc.title}): remote newer, status = modified`)
    return 'modified'
  }

  // If local is 'new' but remote hasn't changed, it's still new
  if (localDoc.sync_status === 'new') {
    console.log(`[determineSyncStatus] Doc ${remoteDoc.id} (${localDoc.title}): local status is new, keeping as new`)
    return 'new'
  }

  const finalStatus = localDoc.sync_status === 'deleted' ? 'synced' : (localDoc.sync_status as 'synced' | 'modified')
  console.log(`[determineSyncStatus] Doc ${remoteDoc.id} (${localDoc.title}): fallback, local_status=${localDoc.sync_status}, final=${finalStatus}`)
  return finalStatus
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
      remoteCreatedAt: remoteDoc.remoteCreatedAt,
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

  // Handle notes specially
  if (bookId === NOTES_BOOK_ID) {
    return getNotes()
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
    remoteCreatedAt: doc.created_at || doc.updated_at || new Date().toISOString(),
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
 * Download note content (小记)
 * Uses cached content from getNotes() call
 * Falls back to API call if not cached
 */
async function downloadNoteContent(noteId: string): Promise<string> {
  console.log(`[downloadNoteContent] Getting content for note: ${noteId}`)
  
  // Try to get from cache first
  const cached = getCachedNoteContent(noteId)
  if (cached) {
    console.log(`[downloadNoteContent] Found cached content, length: ${cached.content.length}`)
    
    // Convert HTML to markdown
    let markdown = htmlToMarkdown(cached.content)
    
    // Add tags as frontmatter if present
    if (cached.tags.length > 0) {
      const tagNames = cached.tags.join(', ')
      markdown = `---\ntags: [${tagNames}]\n---\n\n${markdown}`
    }
    
    // Add metadata
    if (cached.createdAt || cached.updatedAt) {
      const metaLines = []
      if (cached.createdAt) metaLines.push(`创建时间: ${cached.createdAt}`)
      if (cached.updatedAt) metaLines.push(`更新时间: ${cached.updatedAt}`)
      markdown = markdown + `\n\n---\n*${metaLines.join(' | ')}*`
    }
    
    console.log(`[downloadNoteContent] Converted markdown length: ${markdown.length}`)
    return markdown
  }
  
  // Fallback: fetch from API (this shouldn't happen normally)
  console.log(`[downloadNoteContent] No cached content, fetching from API...`)
  
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  // Extract numeric ID from note_XXXXX format
  const numericId = noteId.replace('note_', '')
  const url = `${YUQUE_CONFIG.host}/api/modules/note/notes/NoteController/detail?id=${numericId}`
  console.log(`[downloadNoteContent] API URL: ${url}`)

  try {
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

    console.log(`[downloadNoteContent] Response status: ${response.status}`)
    const noteData = response.data?.data || response.data
    
    // Try different content fields
    let htmlContent = ''
    if (noteData?.content?.abstract) {
      htmlContent = noteData.content.abstract
    } else if (noteData?.abstract) {
      htmlContent = noteData.abstract
    } else if (noteData?.body) {
      htmlContent = noteData.body
    } else if (typeof noteData === 'string') {
      htmlContent = noteData
    }
    
    if (!htmlContent) {
      console.warn(`[downloadNoteContent] No content found for note ${noteId}`)
      return `# 小记\n\n*内容为空或无法获取*`
    }
    
    // Convert HTML to markdown
    let markdown = htmlToMarkdown(htmlContent)
    
    // Add tags as frontmatter if present
    const tags = noteData?.tags || []
    if (tags.length > 0) {
      const tagNames = tags.map((t: any) => t.name).join(', ')
      markdown = `---\ntags: [${tagNames}]\n---\n\n${markdown}`
    }
    
    return markdown
  } catch (error: any) {
    console.error(`[downloadNoteContent] Failed to fetch note ${noteId}:`, error.message)
    throw error
  }
}

/**
 * Simple HTML to Markdown converter
 * Handles Yuque's Lake format (<!doctype lake>)
 */
function htmlToMarkdown(html: string): string {
  if (!html) return ''
  
  let md = html
  
  // Remove Lake doctype and meta tags
  md = md.replace(/<!doctype\s+lake>/gi, '')
  md = md.replace(/<meta[^>]*>/gi, '')
  
  // Handle Lake-specific card elements (checkboxes, etc.)
  md = md.replace(/<card[^>]*type="inline"[^>]*name="checkbox"[^>]*value="true"[^>]*><\/card>/gi, '[x] ')
  md = md.replace(/<card[^>]*type="inline"[^>]*name="checkbox"[^>]*value="false"[^>]*><\/card>/gi, '[ ] ')
  md = md.replace(/<card[^>]*type="inline"[^>]*name="checkbox"[^>]*><\/card>/gi, '[ ] ')
  md = md.replace(/<card[^>]*>[^<]*<\/card>/gi, '')
  
  // Handle Lake list items with task checkboxes
  md = md.replace(/<li[^>]*class="[^"]*lake-list-task[^"]*"[^>]*>/gi, '- ')
  
  // Replace common HTML tags
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<\/p>/gi, '\n\n')
  md = md.replace(/<p[^>]*>/gi, '')
  md = md.replace(/<\/div>/gi, '\n')
  md = md.replace(/<div[^>]*>/gi, '')
  
  // Handle spans (just extract text)
  md = md.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
  
  // Bold
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
  
  // Italic
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
  
  // Code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
  
  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  
  // Images
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*>/gi, '![]($1)')
  
  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n')
  
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
  
  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')
  
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '')
  
  // Decode HTML entities
  md = md.replace(/&nbsp;/g, ' ')
  md = md.replace(/&lt;/g, '<')
  md = md.replace(/&gt;/g, '>')
  md = md.replace(/&amp;/g, '&')
  md = md.replace(/&quot;/g, '"')
  md = md.replace(/&#39;/g, "'")
  md = md.replace(/&ldquo;/g, '"')
  md = md.replace(/&rdquo;/g, '"')
  md = md.replace(/&lsquo;/g, "'")
  md = md.replace(/&rsquo;/g, "'")
  md = md.replace(/&mdash;/g, '—')
  md = md.replace(/&ndash;/g, '–')
  md = md.replace(/&hellip;/g, '...')
  
  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, '\n\n')
  md = md.trim()
  
  return md
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
 * Set file timestamps to match remote Yuque timestamps
 * @param filePath - Path to the file
 * @param createdAt - Remote creation time (ISO string)
 * @param updatedAt - Remote update time (ISO string)
 */
function setFileTimestamps(filePath: string, createdAt: string, updatedAt: string): void {
  try {
    const mtime = new Date(updatedAt)
    const atime = new Date(createdAt)
    
    // Use utimesSync to set access time and modification time
    fs.utimesSync(filePath, atime, mtime)
  } catch (error) {
    console.error(`Failed to set timestamps for ${filePath}:`, error)
  }
}

/**
 * Get sync status
 */
export function getSyncStatus() {
  return {
    isRunning: isSyncing,
    currentSyncHistoryId,
    currentSyncSessionId
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
    // Mark current session as interrupted
    if (currentSyncSessionId) {
      updateSyncSessionStatus(currentSyncSessionId, 'interrupted')
    }
  }
}

/**
 * Get interrupted sync session if any
 * Requirements: 6.3, 6.4
 */
export function getInterruptedSyncSession(): SyncSessionInfo | null {
  const session = getInterruptedSession()
  if (!session) return null
  
  return {
    id: session.id,
    bookIds: JSON.parse(session.book_ids),
    totalDocs: session.total_docs,
    completedDocIds: JSON.parse(session.completed_doc_ids),
    status: session.status,
    startedAt: session.started_at,
    updatedAt: session.updated_at
  }
}

/**
 * Mark all running sessions as interrupted (called on app startup)
 * Requirements: 6.2
 */
export function markRunningSessionsAsInterrupted(): number {
  return markRunningSessonsAsInterrupted()
}

/**
 * Delete/clear an interrupted session
 */
export function clearInterruptedSession(sessionId: number): void {
  updateSyncSessionStatus(sessionId, 'completed')
}

/**
 * Start incremental sync
 * Requirements: 4.2, 4.6, 7.1, 7.2, 7.3
 */
export async function startSync(
  options: SyncOptions,
  bookInfoMap: Map<string, { userLogin: string; slug: string; name: string }>,
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
    
    console.log(`[startSync] Changes detected - new: ${changes.new.length}, modified: ${changes.modified.length}, deleted: ${changes.deleted.length}`)
    console.log(`[startSync] New docs:`, changes.new.map(d => ({ id: d.id, title: d.title, status: d.syncStatus })))
    console.log(`[startSync] Modified docs:`, changes.modified.map(d => ({ id: d.id, title: d.title, status: d.syncStatus })))

    // Determine which documents to sync
    let docsToSync: Document[] = []

    if (options.force) {
      console.log(`[startSync] Force sync mode - including all documents`)
      // Force sync: re-download all documents (including failed ones)
      for (const bookId of bookIds) {
        const localDocs = getDocumentsByBookId(bookId)
        console.log(`[startSync] Book ${bookId} local docs:`, localDocs.map(d => ({ id: d.id, title: d.title, status: d.sync_status })))
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
      console.log(`[startSync] Incremental sync mode - filtering out failed docs`)
      // Incremental sync: only new and modified documents (skip failed ones)
      const allDocs = [...changes.new, ...changes.modified]
      console.log(`[startSync] All docs before filter:`, allDocs.map(d => ({ id: d.id, title: d.title, status: d.syncStatus })))
      docsToSync = allDocs.filter(d => d.syncStatus !== 'failed')
      console.log(`[startSync] Docs after filtering failed:`, docsToSync.map(d => ({ id: d.id, title: d.title, status: d.syncStatus })))
    }

    // Filter by specific document IDs if provided
    if (options.documentIds && options.documentIds.length > 0) {
      console.log(`[startSync] Filtering by specific document IDs:`, options.documentIds)
      const docIdSet = new Set(options.documentIds)
      docsToSync = docsToSync.filter(d => docIdSet.has(d.id))
    }

    // Limit notes to 10 for now (experimental feature)
    const noteDocs = docsToSync.filter(d => d.bookId === NOTES_BOOK_ID)
    const otherDocs = docsToSync.filter(d => d.bookId !== NOTES_BOOK_ID)
    if (noteDocs.length > 10) {
      console.log(`[startSync] Limiting notes from ${noteDocs.length} to 10`)
      docsToSync = [...otherDocs, ...noteDocs.slice(0, 10)]
    }

    const totalDocs = docsToSync.length
    console.log(`[startSync] Final docsToSync count: ${totalDocs}`)

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
        console.log(`[startSync] Processing doc ${i + 1}/${totalDocs}: ${doc.title} (${doc.id}, bookId: ${doc.bookId})`)
        
        // Download content - handle notes differently
        let content: string
        if (doc.bookId === NOTES_BOOK_ID) {
          // Download note content using cached data
          console.log(`[startSync] Downloading note content for: ${doc.id}`)
          try {
            content = await downloadNoteContent(doc.id)
            console.log(`[startSync] Note content downloaded, length: ${content.length}`)
          } catch (noteError: any) {
            console.error(`[startSync] Failed to download note ${doc.id}:`, noteError.message)
            throw new Error(`小记下载失败: ${noteError.message}`)
          }
        } else {
          // Download regular document content
          content = await downloadDocumentContent(
            bookInfo.userLogin,
            bookInfo.slug,
            doc.slug,
            linebreak,
            latexcode
          )
        }

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

        // Sanitize filenames
        const sanitizedTitle = doc.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        const sanitizedBookName = bookInfo.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        const filePath = path.join(syncDirectory, sanitizedBookName, `${sanitizedTitle}.md`)
        const docDir = path.dirname(filePath)
        
        console.log(`[startSync] Writing to: ${filePath}`)

        // Process images in the document content
        // Requirements: 1.1, 1.2, 1.3, 1.7
        let processedContent = content
        try {
          processedContent = await processDocumentImages(
            content,
            doc.id,
            docDir,
            (imgCurrent, imgTotal) => {
              if (onProgress) {
                onProgress({
                  current: i,
                  total: totalDocs,
                  currentDoc: `${doc.title} (图片 ${imgCurrent}/${imgTotal})`,
                  status: 'writing'
                })
              }
            }
          )
        } catch (imgError) {
          // Log image processing error but continue with original content
          console.error(`[startSync] Image processing failed for ${doc.title}:`, imgError)
        }

        // Process attachments in the document content
        // Requirements: 2.1, 2.2, 2.3
        try {
          processedContent = await processDocumentAttachments(
            processedContent,
            doc.id,
            docDir,
            (attCurrent, attTotal) => {
              if (onProgress) {
                onProgress({
                  current: i,
                  total: totalDocs,
                  currentDoc: `${doc.title} (附件 ${attCurrent}/${attTotal})`,
                  status: 'writing'
                })
              }
            }
          )
        } catch (attError) {
          // Log attachment processing error but continue with current content
          console.error(`[startSync] Attachment processing failed for ${doc.title}:`, attError)
        }

        // Write to file
        writeDocumentToFile(filePath, processedContent)

        // Set file timestamps to match remote Yuque timestamps
        const createdAt = doc.remoteCreatedAt || doc.remoteUpdatedAt
        setFileTimestamps(filePath, createdAt, doc.remoteUpdatedAt)

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

        // Mark document as failed so it won't be synced again
        // Use upsertDocument instead of updateDocumentSyncStatus to ensure the document exists in DB
        console.log(`[startSync] Marking doc as failed: ${doc.title} (id: ${doc.id}), error: ${errorMsg}`)
        upsertDocument({
          id: doc.id,
          bookId: doc.bookId,
          slug: doc.slug,
          title: doc.title,
          remoteUpdatedAt: doc.remoteUpdatedAt,
          syncStatus: 'failed'
        })
        
        // Verify the status was updated
        const updatedDoc = getDocumentsByBookId(doc.bookId).find(d => d.id === doc.id)
        console.log(`[startSync] After marking failed, doc status in DB: ${updatedDoc?.sync_status}`)

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
