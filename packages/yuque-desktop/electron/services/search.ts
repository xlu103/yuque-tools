/**
 * Search Service
 * Provides local document search functionality
 * Requirements: 3.2, 3.3, 3.4, 3.6
 */

import * as fs from 'fs'
import { getAllDocuments, getDocumentsByBookId } from '../db/stores/documents'
import { getAllBooks } from '../db/stores/books'
import type { DocumentRecord, BookRecord } from '../db/stores/types'

/**
 * Search options
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number
  /** Filter by specific book ID */
  bookId?: string
  /** Whether to search document content (default: true) */
  searchContent?: boolean
}

/**
 * Search result item
 */
export interface SearchResult {
  /** Document ID */
  docId: string
  /** Document title */
  title: string
  /** Book ID */
  bookId: string
  /** Book name */
  bookName: string
  /** Matching snippet with context */
  snippet: string
  /** Type of match */
  matchType: 'title' | 'content'
  /** Local file path */
  localPath: string | null
}

/**
 * Generate a snippet from content around the match position
 * @param content - Full content text
 * @param query - Search query
 * @param contextLength - Number of characters to include before and after match
 * @returns Snippet with match highlighted
 */
export function generateSnippet(
  content: string,
  query: string,
  contextLength: number = 50
): string {
  if (!content || !query) {
    return ''
  }

  // Case-insensitive search
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerContent.indexOf(lowerQuery)

  if (matchIndex === -1) {
    return ''
  }

  // Calculate start and end positions for snippet
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(content.length, matchIndex + query.length + contextLength)

  // Extract snippet
  let snippet = content.substring(start, end)

  // Add ellipsis if truncated
  if (start > 0) {
    snippet = '...' + snippet
  }
  if (end < content.length) {
    snippet = snippet + '...'
  }

  // Clean up whitespace
  snippet = snippet.replace(/\s+/g, ' ').trim()

  return snippet
}

/**
 * Check if a string contains the query (case-insensitive)
 * Supports Chinese character search
 * @param text - Text to search in
 * @param query - Search query
 * @returns True if text contains query
 */
export function containsQuery(text: string, query: string): boolean {
  if (!text || !query) {
    return false
  }
  return text.toLowerCase().includes(query.toLowerCase())
}

/**
 * Read document content from file
 * @param filePath - Path to the markdown file
 * @returns File content or null if read fails
 */
export function readDocumentContent(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error(`[search] Failed to read file ${filePath}:`, error)
    return null
  }
}

/**
 * Search documents by title (database query)
 * Requirements: 3.2
 * @param query - Search query
 * @param documents - Documents to search
 * @param booksMap - Map of book ID to book record
 * @returns Array of search results
 */
export function searchByTitle(
  query: string,
  documents: DocumentRecord[],
  booksMap: Map<string, BookRecord>
): SearchResult[] {
  const results: SearchResult[] = []

  for (const doc of documents) {
    if (containsQuery(doc.title, query)) {
      const book = booksMap.get(doc.book_id)
      results.push({
        docId: doc.id,
        title: doc.title,
        bookId: doc.book_id,
        bookName: book?.name || '未知知识库',
        snippet: generateSnippet(doc.title, query, 30),
        matchType: 'title',
        localPath: doc.local_path
      })
    }
  }

  return results
}

/**
 * Search documents by content (file reading)
 * Requirements: 3.3
 * @param query - Search query
 * @param documents - Documents to search
 * @param booksMap - Map of book ID to book record
 * @param excludeDocIds - Document IDs to exclude (already matched by title)
 * @returns Array of search results
 */
export function searchByContent(
  query: string,
  documents: DocumentRecord[],
  booksMap: Map<string, BookRecord>,
  excludeDocIds: Set<string> = new Set()
): SearchResult[] {
  const results: SearchResult[] = []

  for (const doc of documents) {
    // Skip if already matched by title or no local path
    if (excludeDocIds.has(doc.id) || !doc.local_path) {
      continue
    }

    // Read file content
    const content = readDocumentContent(doc.local_path)
    if (!content) {
      continue
    }

    // Check if content contains query
    if (containsQuery(content, query)) {
      const book = booksMap.get(doc.book_id)
      results.push({
        docId: doc.id,
        title: doc.title,
        bookId: doc.book_id,
        bookName: book?.name || '未知知识库',
        snippet: generateSnippet(content, query),
        matchType: 'content',
        localPath: doc.local_path
      })
    }
  }

  return results
}

/**
 * Search documents
 * Requirements: 3.2, 3.3, 3.4, 3.6
 * @param query - Search query
 * @param options - Search options
 * @returns Array of search results
 */
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 50, bookId, searchContent = true } = options

  // Validate query
  if (!query || query.trim().length === 0) {
    return []
  }

  const trimmedQuery = query.trim()

  // Get documents to search
  let documents: DocumentRecord[]
  if (bookId) {
    documents = getDocumentsByBookId(bookId)
  } else {
    documents = getAllDocuments()
  }

  // Filter out deleted documents
  documents = documents.filter(doc => doc.sync_status !== 'deleted')

  // Build books map for efficient lookup
  const books = getAllBooks()
  const booksMap = new Map<string, BookRecord>(books.map(b => [b.id, b]))

  // Search by title first
  const titleResults = searchByTitle(trimmedQuery, documents, booksMap)
  const titleMatchedIds = new Set(titleResults.map(r => r.docId))

  // Search by content if enabled
  let contentResults: SearchResult[] = []
  if (searchContent) {
    contentResults = searchByContent(trimmedQuery, documents, booksMap, titleMatchedIds)
  }

  // Combine results (title matches first, then content matches)
  const allResults = [...titleResults, ...contentResults]

  // Apply limit
  return allResults.slice(0, limit)
}

/**
 * Search service interface for IPC
 */
export const searchService = {
  search,
  generateSnippet,
  containsQuery
}
