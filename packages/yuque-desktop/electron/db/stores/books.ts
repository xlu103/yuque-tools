/**
 * Books Store
 * CRUD operations for knowledge bases
 */

import { getDatabase } from '../index'
import type { BookRecord, BookInput } from './types'

/**
 * Get all books
 */
export function getAllBooks(): BookRecord[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM books ORDER BY name').all() as BookRecord[]
}

/**
 * Get a book by ID
 */
export function getBookById(id: string): BookRecord | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM books WHERE id = ?').get(id) as BookRecord | undefined
}

/**
 * Get books by type
 */
export function getBooksByType(type: 'owner' | 'collab'): BookRecord[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM books WHERE type = ? ORDER BY name').all(type) as BookRecord[]
}

/**
 * Insert or update a book
 */
export function upsertBook(book: BookInput): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO books (id, slug, name, user_login, type, doc_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      user_login = excluded.user_login,
      type = excluded.type,
      doc_count = excluded.doc_count,
      updated_at = datetime('now')
  `).run(book.id, book.slug, book.name, book.userLogin, book.type, book.docCount)
}

/**
 * Insert or update multiple books
 */
export function upsertBooks(books: BookInput[]): void {
  const db = getDatabase()
  const upsert = db.prepare(`
    INSERT INTO books (id, slug, name, user_login, type, doc_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      user_login = excluded.user_login,
      type = excluded.type,
      doc_count = excluded.doc_count,
      updated_at = datetime('now')
  `)

  const insertMany = db.transaction((items: BookInput[]) => {
    for (const book of items) {
      upsert.run(book.id, book.slug, book.name, book.userLogin, book.type, book.docCount)
    }
  })

  insertMany(books)
}

/**
 * Delete a book by ID
 */
export function deleteBook(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM books WHERE id = ?').run(id)
}

/**
 * Delete all books
 */
export function deleteAllBooks(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM books').run()
}

/**
 * Update book document count
 */
export function updateBookDocCount(id: string, docCount: number): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE books SET doc_count = ?, updated_at = datetime('now') WHERE id = ?
  `).run(docCount, id)
}

/**
 * Get total book count
 */
export function getBookCount(): number {
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number }
  return result.count
}
