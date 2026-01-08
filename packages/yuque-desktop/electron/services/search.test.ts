/**
 * Property-Based Tests for Search Service
 * 
 * Feature: yuque-desktop-enhancements
 * Tests correctness properties for search functionality
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  generateSnippet, 
  containsQuery,
  searchByTitle,
  searchByContent
} from './search'
import type { DocumentRecord, BookRecord } from '../db/stores/types'

// Generate a valid document record for testing (currently unused but kept for future tests)
// @ts-expect-error - Kept for future property-based tests
const documentRecordArb = (bookId: string = 'book-1'): fc.Arbitrary<DocumentRecord> => 
  fc.record({
    id: fc.uuid(),
    book_id: fc.constant(bookId),
    slug: fc.hexaString({ minLength: 4, maxLength: 12 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    uuid: fc.option(fc.uuid(), { nil: null }),
    parent_uuid: fc.option(fc.uuid(), { nil: null }),
    child_uuid: fc.option(fc.uuid(), { nil: null }),
    doc_type: fc.constantFrom('DOC', 'TITLE') as fc.Arbitrary<'DOC' | 'TITLE'>,
    depth: fc.integer({ min: 0, max: 5 }),
    sort_order: fc.integer({ min: 0, max: 1000 }),
    local_path: fc.option(fc.constant('/tmp/test.md'), { nil: null }),
    remote_updated_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
    local_synced_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
    sync_status: fc.constantFrom('synced', 'pending', 'modified', 'new', 'deleted', 'failed') as fc.Arbitrary<'synced' | 'pending' | 'modified' | 'new' | 'deleted' | 'failed'>,
    created_at: fc.date().map(d => d.toISOString()),
    updated_at: fc.date().map(d => d.toISOString())
  })

// Generate a book record for testing
const bookRecordArb: fc.Arbitrary<BookRecord> = fc.record({
  id: fc.uuid(),
  slug: fc.hexaString({ minLength: 4, maxLength: 12 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  user_login: fc.hexaString({ minLength: 4, maxLength: 12 }),
  type: fc.constantFrom('owner', 'collab') as fc.Arbitrary<'owner' | 'collab'>,
  doc_count: fc.integer({ min: 0, max: 1000 }),
  created_at: fc.date().map(d => d.toISOString()),
  updated_at: fc.date().map(d => d.toISOString())
})

// Generate a non-empty search query
const searchQueryArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0)

// Generate Chinese text for testing Chinese search support
const chineseTextArb = fc.constantFrom(
  '文档', '知识库', '搜索', '测试', '语雀', '同步', '下载', '图片', '附件'
)

describe('Search Service Property Tests', () => {
  /**
   * Property 5: Search Result Accuracy
   * For any search query, if a document's title or content contains the query string,
   * that document SHALL appear in the search results with the correct metadata.
   * 
   * **Validates: Requirements 3.2, 3.3, 3.6**
   */
  describe('Property 5: Search Result Accuracy', () => {
    describe('containsQuery function', () => {
      it('should return true when text contains query (case-insensitive)', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ minLength: 0, maxLength: 50 }),
            (prefix, query, suffix) => {
              const text = prefix + query + suffix
              expect(containsQuery(text, query)).toBe(true)
              // Case insensitive
              expect(containsQuery(text, query.toUpperCase())).toBe(true)
              expect(containsQuery(text, query.toLowerCase())).toBe(true)
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should return false when text does not contain query', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 10 }),
            (text, query) => {
              // Only test when query is not in text
              fc.pre(!text.toLowerCase().includes(query.toLowerCase()))
              expect(containsQuery(text, query)).toBe(false)
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should support Chinese character search', () => {
        fc.assert(
          fc.property(
            chineseTextArb,
            fc.string({ minLength: 0, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 20 }),
            (chineseQuery, prefix, suffix) => {
              const text = prefix + chineseQuery + suffix
              expect(containsQuery(text, chineseQuery)).toBe(true)
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should handle empty inputs gracefully', () => {
        expect(containsQuery('', 'query')).toBe(false)
        expect(containsQuery('text', '')).toBe(false)
        expect(containsQuery('', '')).toBe(false)
      })
    })

    describe('generateSnippet function', () => {
      it('should generate snippet containing the query', () => {
        // Generate non-whitespace queries (realistic search queries)
        const nonWhitespaceQueryArb = fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => s.trim().length > 0)
        
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            nonWhitespaceQueryArb,
            fc.string({ minLength: 0, maxLength: 100 }),
            (prefix, query, suffix) => {
              const content = prefix + query + suffix
              const snippet = generateSnippet(content, query)
              
              // Snippet should contain the query (case-insensitive check)
              // Note: whitespace in query may be normalized in snippet
              const normalizedQuery = query.replace(/\s+/g, ' ').trim()
              if (normalizedQuery.length > 0) {
                expect(snippet.toLowerCase()).toContain(normalizedQuery.toLowerCase())
              }
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should return empty string when query not found', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 10 }),
            (content, query) => {
              fc.pre(!content.toLowerCase().includes(query.toLowerCase()))
              const snippet = generateSnippet(content, query)
              expect(snippet).toBe('')
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should handle empty inputs gracefully', () => {
        expect(generateSnippet('', 'query')).toBe('')
        expect(generateSnippet('content', '')).toBe('')
        expect(generateSnippet('', '')).toBe('')
      })
    })

    describe('searchByTitle function', () => {
      it('should find documents whose title contains the query', () => {
        fc.assert(
          fc.property(
            searchQueryArb,
            bookRecordArb,
            fc.integer({ min: 1, max: 10 }),
            (query, book, docCount) => {
              // Create documents with titles containing the query
              const documents: DocumentRecord[] = []
              const booksMap = new Map<string, BookRecord>([[book.id, book]])
              
              for (let i = 0; i < docCount; i++) {
                documents.push({
                  id: `doc-${i}`,
                  book_id: book.id,
                  slug: `slug-${i}`,
                  title: `Document ${query} ${i}`, // Title contains query
                  uuid: null,
                  parent_uuid: null,
                  child_uuid: null,
                  doc_type: 'DOC',
                  depth: 0,
                  sort_order: i,
                  local_path: `/tmp/doc-${i}.md`,
                  remote_updated_at: new Date().toISOString(),
                  local_synced_at: new Date().toISOString(),
                  sync_status: 'synced',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
              }
              
              const results = searchByTitle(query, documents, booksMap)
              
              // All documents should be found
              expect(results.length).toBe(docCount)
              
              // Each result should have correct metadata
              for (const result of results) {
                expect(result.matchType).toBe('title')
                expect(result.bookId).toBe(book.id)
                expect(result.bookName).toBe(book.name)
                expect(result.title.toLowerCase()).toContain(query.toLowerCase())
              }
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should not find documents whose title does not contain the query', () => {
        fc.assert(
          fc.property(
            searchQueryArb,
            bookRecordArb,
            (query, book) => {
              // Create document with title NOT containing the query
              const documents: DocumentRecord[] = [{
                id: 'doc-1',
                book_id: book.id,
                slug: 'slug-1',
                title: 'Completely Different Title',
                uuid: null,
                parent_uuid: null,
                child_uuid: null,
                doc_type: 'DOC',
                depth: 0,
                sort_order: 0,
                local_path: '/tmp/doc-1.md',
                remote_updated_at: new Date().toISOString(),
                local_synced_at: new Date().toISOString(),
                sync_status: 'synced',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]
              
              // Ensure query is not in the title
              fc.pre(!documents[0].title.toLowerCase().includes(query.toLowerCase()))
              
              const booksMap = new Map<string, BookRecord>([[book.id, book]])
              const results = searchByTitle(query, documents, booksMap)
              
              expect(results.length).toBe(0)
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should return correct book name in results', () => {
        fc.assert(
          fc.property(
            searchQueryArb,
            bookRecordArb,
            (query, book) => {
              const documents: DocumentRecord[] = [{
                id: 'doc-1',
                book_id: book.id,
                slug: 'slug-1',
                title: `Title with ${query}`,
                uuid: null,
                parent_uuid: null,
                child_uuid: null,
                doc_type: 'DOC',
                depth: 0,
                sort_order: 0,
                local_path: '/tmp/doc-1.md',
                remote_updated_at: new Date().toISOString(),
                local_synced_at: new Date().toISOString(),
                sync_status: 'synced',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]
              
              const booksMap = new Map<string, BookRecord>([[book.id, book]])
              const results = searchByTitle(query, documents, booksMap)
              
              expect(results.length).toBe(1)
              expect(results[0].bookName).toBe(book.name)
              expect(results[0].bookId).toBe(book.id)
            }
          ),
          { numRuns: 100 }
        )
      })
    })

    describe('searchByContent function', () => {
      it('should exclude documents already matched by title', () => {
        fc.assert(
          fc.property(
            searchQueryArb,
            bookRecordArb,
            (query, book) => {
              const documents: DocumentRecord[] = [{
                id: 'doc-1',
                book_id: book.id,
                slug: 'slug-1',
                title: `Title with ${query}`,
                uuid: null,
                parent_uuid: null,
                child_uuid: null,
                doc_type: 'DOC',
                depth: 0,
                sort_order: 0,
                local_path: '/tmp/doc-1.md',
                remote_updated_at: new Date().toISOString(),
                local_synced_at: new Date().toISOString(),
                sync_status: 'synced',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]
              
              const booksMap = new Map<string, BookRecord>([[book.id, book]])
              const excludeDocIds = new Set(['doc-1'])
              
              const results = searchByContent(query, documents, booksMap, excludeDocIds)
              
              // Document should be excluded
              expect(results.length).toBe(0)
            }
          ),
          { numRuns: 100 }
        )
      })

      it('should skip documents without local path', () => {
        fc.assert(
          fc.property(
            searchQueryArb,
            bookRecordArb,
            (query, book) => {
              const documents: DocumentRecord[] = [{
                id: 'doc-1',
                book_id: book.id,
                slug: 'slug-1',
                title: 'Some Title',
                uuid: null,
                parent_uuid: null,
                child_uuid: null,
                doc_type: 'DOC',
                depth: 0,
                sort_order: 0,
                local_path: null, // No local path
                remote_updated_at: new Date().toISOString(),
                local_synced_at: new Date().toISOString(),
                sync_status: 'synced',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]
              
              const booksMap = new Map<string, BookRecord>([[book.id, book]])
              const results = searchByContent(query, documents, booksMap)
              
              // Document should be skipped
              expect(results.length).toBe(0)
            }
          ),
          { numRuns: 100 }
        )
      })
    })
  })
})
