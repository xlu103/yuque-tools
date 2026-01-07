/**
 * Books Service
 * Handles knowledge base and document fetching from Yuque API
 * Adapted from yuque-tools-cli getBookStacks and getDocsOfBooks functions
 */

import axios from 'axios'
import { getValidSession } from '../db/stores/auth'
import type { KnowledgeBase, Document } from '../ipc/types'

// Yuque API configuration
const YUQUE_CONFIG = {
  host: 'https://www.yuque.com',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G81 YuqueMobileApp/1.0.2 (AppBuild/650 Device/Phone Locale/zh-cn Theme/light YuqueType/public)'
}

// API endpoints (from yuque-tools-cli)
const YUQUE_API = {
  // Personal knowledge base list
  booksList: '/api/mine/book_stacks',
  // Collaborative knowledge bases
  collabBooks: '/api/mine/raw_collab_books',
  // Space knowledge base list
  booksListOfSpace: '/api/mine/user_books?user_type=Group',
  // Documents in a knowledge base
  docsOfBook: (bookId: string) => `/api/docs?book_id=${bookId}`,
  // Notes (小记)
  notes: (offset: number, limit: number) => 
    `/api/modules/note/notes/NoteController/index?offset=${offset}&q=&filter_type=all&status=0&merge_dynamic_data=0&order=content_updated_at&with_pinned_notes=true&limit=${limit}`
}

// API response types
interface YuqueUser {
  name: string
  login: string
}

interface YuqueBookItem {
  id: number | string
  slug: string
  name: string
  user: YuqueUser
  items_count?: number
}

interface YuqueBookStackItem {
  books: YuqueBookItem[]
  name: string
  id: number
}

interface YuqueDocItem {
  id: number | string
  slug: string
  title: string
  description?: string
  created_at?: string
  content_updated_at?: string
  updated_at?: string
}

// Note types (小记)
interface YuqueNoteTag {
  id: number
  name: string
}

interface YuqueNoteContent {
  updated_at: string
  abstract: string
}

interface YuqueNote {
  id: number
  slug: string
  tags: YuqueNoteTag[]
  content: YuqueNoteContent
  created_at?: string
  updated_at?: string
}

interface YuqueNotesResponse {
  notes: YuqueNote[]
  pin_notes: YuqueNote[]
  has_more: boolean
}

// Special book ID for notes
export const NOTES_BOOK_ID = '__notes__'
export const NOTES_BOOK_NAME = '小记'

/**
 * Make authenticated GET request to Yuque API
 */
async function yuqueGet<T>(endpoint: string): Promise<{ data: T }> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  const response = await axios({
    url: YUQUE_CONFIG.host + endpoint,
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
 * Get collaborative knowledge bases
 */
async function getCollabBooks(): Promise<YuqueBookItem[]> {
  try {
    const { data } = await yuqueGet<YuqueBookItem[]>(YUQUE_API.collabBooks)
    return data || []
  } catch (error) {
    console.error('Failed to fetch collab books:', error)
    return []
  }
}

/**
 * Get all knowledge bases (personal + collaborative + notes)
 * Adapted from yuque-tools-cli getBookStacks function
 */
export async function getBookStacks(): Promise<KnowledgeBase[]> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  // Fetch personal knowledge bases
  const { data: bookStacksData = [] } = await yuqueGet<YuqueBookStackItem[]>(YUQUE_API.booksList)

  // Fetch collaborative knowledge bases
  const collabBooks = await getCollabBooks()

  // Get current user login for determining ownership
  const currentLogin = session.login

  // Flatten personal book stacks
  const personalBooks: YuqueBookItem[] = bookStacksData
    .map((stack) => stack.books)
    .flat()

  // Combine personal and collaborative books
  const allBooks = [...personalBooks, ...collabBooks]

  // Transform to KnowledgeBase format
  const knowledgeBases: KnowledgeBase[] = allBooks.map((book) => ({
    id: String(book.id),
    slug: book.slug,
    name: book.name,
    userLogin: book.user.login,
    type: currentLogin === book.user.login ? 'owner' : 'collab',
    docCount: book.items_count || 0
  }))

  // Get notes count
  let notesCount = 0
  try {
    // Fetch just 1 note to get the total count from response
    const response = await yuqueGet<any>(YUQUE_API.notes(0, 1))
    const notesData = response.data || response
    // Count from pin_notes and notes arrays, or use has_more to estimate
    const pinNotes = notesData?.pin_notes || []
    const regularNotes = notesData?.notes || []
    notesCount = pinNotes.length + regularNotes.length
    // If has_more is true, there are more notes
    if (notesData?.has_more) {
      notesCount = 20 // Show "20+" as estimate
    }
    console.log(`[getBookStacks] Notes count: ${notesCount}`)
  } catch (error) {
    console.error('[getBookStacks] Failed to get notes count:', error)
  }

  // Add "小记" as a special knowledge base at the beginning
  const notesBook: KnowledgeBase = {
    id: NOTES_BOOK_ID,
    slug: 'notes',
    name: NOTES_BOOK_NAME,
    userLogin: currentLogin,
    type: 'owner',
    docCount: notesCount
  }

  return [notesBook, ...knowledgeBases]
}

/**
 * Get documents in a knowledge base
 * Adapted from yuque-tools-cli getDocsOfBooks function
 */
export async function getDocsOfBook(bookId: string): Promise<Document[]> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  // Handle notes specially
  if (bookId === NOTES_BOOK_ID) {
    return getNotes()
  }

  const { data: docsData = [] } = await yuqueGet<YuqueDocItem[]>(YUQUE_API.docsOfBook(bookId))

  // Transform to Document format
  const documents: Document[] = docsData.map((doc) => ({
    id: String(doc.id),
    bookId: bookId,
    slug: doc.slug,
    title: doc.title,
    remoteCreatedAt: doc.created_at || doc.updated_at || new Date().toISOString(),
    remoteUpdatedAt: doc.content_updated_at || doc.updated_at || new Date().toISOString(),
    syncStatus: 'new' as const
  }))

  return documents
}

// Cache for note content (used during sync)
const noteContentCache = new Map<string, { content: string; tags: string[]; createdAt: string; updatedAt: string }>()

/**
 * Get cached note content for sync
 */
export function getCachedNoteContent(noteId: string): { content: string; tags: string[]; createdAt: string; updatedAt: string } | undefined {
  return noteContentCache.get(noteId)
}

/**
 * Clear note content cache
 */
export function clearNoteContentCache(): void {
  noteContentCache.clear()
}

/**
 * Get notes (小记) - lazy loading with limit
 * Only fetches first page of notes for display
 * Also caches content for sync
 */
export async function getNotes(limit: number = 20): Promise<Document[]> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  console.log(`[getNotes] Fetching notes with limit: ${limit}`)

  try {
    const response = await yuqueGet<any>(YUQUE_API.notes(0, limit))
    console.log(`[getNotes] Raw API response:`, JSON.stringify(response).substring(0, 500))
    
    const notesData = response.data || response
    console.log(`[getNotes] Notes data keys:`, Object.keys(notesData || {}))
    
    // Combine regular notes and pinned notes
    const pinNotes = notesData?.pin_notes || []
    const regularNotes = notesData?.notes || []
    const notes = [...pinNotes, ...regularNotes]
    
    console.log(`[getNotes] Found ${pinNotes.length} pinned notes, ${regularNotes.length} regular notes`)
    
    // Clear cache before populating
    noteContentCache.clear()
    
    const allNotes: Document[] = []
    
    for (const note of notes) {
      const noteId = `note_${note.id}`
      const content = note.content?.abstract || ''
      const tags = note.tags?.map((t: any) => t.name) || []
      const createdAt = note.created_at || note.content?.updated_at || new Date().toISOString()
      const updatedAt = note.content?.updated_at || note.updated_at || new Date().toISOString()
      
      // Cache the content for sync
      noteContentCache.set(noteId, {
        content,
        tags,
        createdAt,
        updatedAt
      })
      
      console.log(`[getNotes] Processing note:`, {
        id: note.id,
        slug: note.slug,
        tags,
        contentLength: content.length,
        abstract: content.substring(0, 100)
      })
      
      // Generate title from content (first line or first 50 chars)
      let title = content.split('\n')[0] || '无标题小记'
      // Remove HTML tags
      title = title.replace(/<[^>]*>/g, '').trim()
      // Truncate if too long
      if (title.length > 50) {
        title = title.substring(0, 50) + '...'
      }
      if (!title) {
        title = '无标题小记'
      }

      // Add tags to title if present
      if (tags.length > 0) {
        title = `[${tags.join(', ')}] ${title}`
      }

      allNotes.push({
        id: noteId,
        bookId: NOTES_BOOK_ID,
        slug: note.slug,
        title: title,
        remoteCreatedAt: createdAt,
        remoteUpdatedAt: updatedAt,
        syncStatus: 'new' as const
      })
    }

    console.log(`[getNotes] Processed ${allNotes.length} notes, cached ${noteContentCache.size} contents`)
    return allNotes
  } catch (error) {
    console.error('[getNotes] Failed to fetch notes:', error)
    throw error
  }
}

/**
 * Load more notes with offset (for lazy loading)
 * Returns notes starting from offset
 */
export async function loadMoreNotes(offset: number, limit: number = 20): Promise<{ notes: Document[]; hasMore: boolean }> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  console.log(`[loadMoreNotes] Fetching notes with offset: ${offset}, limit: ${limit}`)

  try {
    const response = await yuqueGet<any>(YUQUE_API.notes(offset, limit))
    const notesData = response.data || response
    
    // Only regular notes (pinned notes are only in first page)
    const notes = notesData?.notes || []
    const hasMore = notesData?.has_more || false
    
    console.log(`[loadMoreNotes] Found ${notes.length} notes, hasMore: ${hasMore}`)
    
    const allNotes: Document[] = []
    
    for (const note of notes) {
      const noteId = `note_${note.id}`
      const content = note.content?.abstract || ''
      const tags = note.tags?.map((t: any) => t.name) || []
      const createdAt = note.created_at || note.content?.updated_at || new Date().toISOString()
      const updatedAt = note.content?.updated_at || note.updated_at || new Date().toISOString()
      
      // Cache the content for sync
      noteContentCache.set(noteId, {
        content,
        tags,
        createdAt,
        updatedAt
      })
      
      // Generate title from content
      let title = content.split('\n')[0] || '无标题小记'
      title = title.replace(/<[^>]*>/g, '').trim()
      if (title.length > 50) {
        title = title.substring(0, 50) + '...'
      }
      if (!title) {
        title = '无标题小记'
      }
      if (tags.length > 0) {
        title = `[${tags.join(', ')}] ${title}`
      }

      allNotes.push({
        id: noteId,
        bookId: NOTES_BOOK_ID,
        slug: note.slug,
        title: title,
        remoteCreatedAt: createdAt,
        remoteUpdatedAt: updatedAt,
        syncStatus: 'new' as const
      })
    }

    console.log(`[loadMoreNotes] Processed ${allNotes.length} notes`)
    return { notes: allNotes, hasMore }
  } catch (error) {
    console.error('[loadMoreNotes] Failed to fetch notes:', error)
    throw error
  }
}

/**
 * Get all notes for sync (fetches all pages)
 * Used for global sync to ensure all notes are synced
 */
export async function getAllNotesForSync(): Promise<Document[]> {
  const session = getValidSession()
  if (!session) {
    throw new Error('未登录或会话已过期')
  }

  console.log(`[getAllNotesForSync] Fetching all notes for sync`)
  
  // Clear cache before fetching all
  noteContentCache.clear()
  
  const allNotes: Document[] = []
  let offset = 0
  const limit = 50 // Fetch in larger batches for sync
  let hasMore = true
  let isFirstPage = true

  try {
    while (hasMore) {
      console.log(`[getAllNotesForSync] Fetching page at offset: ${offset}`)
      const response = await yuqueGet<any>(YUQUE_API.notes(offset, limit))
      const notesData = response.data || response
      
      // First page includes pinned notes
      const pinNotes = isFirstPage ? (notesData?.pin_notes || []) : []
      const regularNotes = notesData?.notes || []
      const notes = [...pinNotes, ...regularNotes]
      hasMore = notesData?.has_more || false
      
      console.log(`[getAllNotesForSync] Got ${notes.length} notes (pinned: ${pinNotes.length}, regular: ${regularNotes.length}), hasMore: ${hasMore}`)
      
      for (const note of notes) {
        const noteId = `note_${note.id}`
        const content = note.content?.abstract || ''
        const tags = note.tags?.map((t: any) => t.name) || []
        const createdAt = note.created_at || note.content?.updated_at || new Date().toISOString()
        const updatedAt = note.content?.updated_at || note.updated_at || new Date().toISOString()
        
        // Cache the content for sync
        noteContentCache.set(noteId, {
          content,
          tags,
          createdAt,
          updatedAt
        })
        
        // Generate title from content
        let title = content.split('\n')[0] || '无标题小记'
        title = title.replace(/<[^>]*>/g, '').trim()
        if (title.length > 50) {
          title = title.substring(0, 50) + '...'
        }
        if (!title) {
          title = '无标题小记'
        }
        if (tags.length > 0) {
          title = `[${tags.join(', ')}] ${title}`
        }

        allNotes.push({
          id: noteId,
          bookId: NOTES_BOOK_ID,
          slug: note.slug,
          title: title,
          remoteCreatedAt: createdAt,
          remoteUpdatedAt: updatedAt,
          syncStatus: 'new' as const
        })
      }
      
      offset += limit
      isFirstPage = false
      
      // Safety limit to prevent infinite loops
      if (offset > 5000) {
        console.warn(`[getAllNotesForSync] Reached safety limit at offset ${offset}`)
        break
      }
    }

    console.log(`[getAllNotesForSync] Total notes fetched: ${allNotes.length}, cached: ${noteContentCache.size}`)
    return allNotes
  } catch (error) {
    console.error('[getAllNotesForSync] Failed to fetch all notes:', error)
    throw error
  }
}
