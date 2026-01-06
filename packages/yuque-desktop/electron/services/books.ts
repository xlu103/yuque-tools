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
  docsOfBook: (bookId: string) => `/api/docs?book_id=${bookId}`
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
 * Get all knowledge bases (personal + collaborative)
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

  return knowledgeBases
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
