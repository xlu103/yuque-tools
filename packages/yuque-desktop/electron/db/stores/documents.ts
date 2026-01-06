/**
 * Documents Store
 * CRUD operations for document metadata
 */

import { getDatabase } from '../index'
import type { DocumentRecord, DocumentInput, DocumentUpdate } from './types'

/**
 * Get all documents
 */
export function getAllDocuments(): DocumentRecord[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM documents ORDER BY title').all() as DocumentRecord[]
}

/**
 * Get a document by ID
 */
export function getDocumentById(id: string): DocumentRecord | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRecord | undefined
}

/**
 * Get documents by book ID
 */
export function getDocumentsByBookId(bookId: string): DocumentRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM documents WHERE book_id = ? ORDER BY title'
  ).all(bookId) as DocumentRecord[]
}

/**
 * Get documents by sync status
 */
export function getDocumentsByStatus(
  status: 'synced' | 'pending' | 'modified' | 'new' | 'deleted'
): DocumentRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM documents WHERE sync_status = ? ORDER BY title'
  ).all(status) as DocumentRecord[]
}

/**
 * Get documents with pending changes (not synced)
 */
export function getPendingDocuments(): DocumentRecord[] {
  const db = getDatabase()
  return db.prepare(
    "SELECT * FROM documents WHERE sync_status != 'synced' ORDER BY title"
  ).all() as DocumentRecord[]
}

/**
 * Insert or update a document
 */
export function upsertDocument(doc: DocumentInput): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO documents (id, book_id, slug, title, local_path, remote_updated_at, local_synced_at, sync_status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      book_id = excluded.book_id,
      slug = excluded.slug,
      title = excluded.title,
      local_path = COALESCE(excluded.local_path, documents.local_path),
      remote_updated_at = COALESCE(excluded.remote_updated_at, documents.remote_updated_at),
      local_synced_at = COALESCE(excluded.local_synced_at, documents.local_synced_at),
      sync_status = COALESCE(excluded.sync_status, documents.sync_status),
      updated_at = datetime('now')
  `).run(
    doc.id,
    doc.bookId,
    doc.slug,
    doc.title,
    doc.localPath ?? null,
    doc.remoteUpdatedAt ?? null,
    doc.localSyncedAt ?? null,
    doc.syncStatus ?? 'new'
  )
}

/**
 * Insert or update multiple documents
 */
export function upsertDocuments(docs: DocumentInput[]): void {
  const db = getDatabase()
  const upsert = db.prepare(`
    INSERT INTO documents (id, book_id, slug, title, local_path, remote_updated_at, local_synced_at, sync_status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      book_id = excluded.book_id,
      slug = excluded.slug,
      title = excluded.title,
      local_path = COALESCE(excluded.local_path, documents.local_path),
      remote_updated_at = COALESCE(excluded.remote_updated_at, documents.remote_updated_at),
      local_synced_at = COALESCE(excluded.local_synced_at, documents.local_synced_at),
      sync_status = COALESCE(excluded.sync_status, documents.sync_status),
      updated_at = datetime('now')
  `)

  const insertMany = db.transaction((items: DocumentInput[]) => {
    for (const doc of items) {
      upsert.run(
        doc.id,
        doc.bookId,
        doc.slug,
        doc.title,
        doc.localPath ?? null,
        doc.remoteUpdatedAt ?? null,
        doc.localSyncedAt ?? null,
        doc.syncStatus ?? 'new'
      )
    }
  })

  insertMany(docs)
}

/**
 * Update a document
 */
export function updateDocument(id: string, update: DocumentUpdate): void {
  const db = getDatabase()
  const sets: string[] = ['updated_at = datetime(\'now\')']
  const values: (string | null)[] = []

  if (update.localPath !== undefined) {
    sets.push('local_path = ?')
    values.push(update.localPath)
  }
  if (update.remoteUpdatedAt !== undefined) {
    sets.push('remote_updated_at = ?')
    values.push(update.remoteUpdatedAt)
  }
  if (update.localSyncedAt !== undefined) {
    sets.push('local_synced_at = ?')
    values.push(update.localSyncedAt)
  }
  if (update.syncStatus !== undefined) {
    sets.push('sync_status = ?')
    values.push(update.syncStatus)
  }

  values.push(id)
  db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

/**
 * Update sync status for a document
 */
export function updateDocumentSyncStatus(
  id: string,
  status: 'synced' | 'pending' | 'modified' | 'new' | 'deleted',
  localSyncedAt?: string
): void {
  const db = getDatabase()
  if (localSyncedAt) {
    db.prepare(`
      UPDATE documents SET sync_status = ?, local_synced_at = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, localSyncedAt, id)
  } else {
    db.prepare(`
      UPDATE documents SET sync_status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id)
  }
}

/**
 * Mark documents as deleted that are not in the provided ID list
 */
export function markDeletedDocuments(bookId: string, existingIds: string[]): number {
  const db = getDatabase()
  
  if (existingIds.length === 0) {
    // Mark all documents in this book as deleted
    const result = db.prepare(`
      UPDATE documents SET sync_status = 'deleted', updated_at = datetime('now')
      WHERE book_id = ? AND sync_status != 'deleted'
    `).run(bookId)
    return result.changes
  }

  // Mark documents not in the list as deleted
  const placeholders = existingIds.map(() => '?').join(',')
  const result = db.prepare(`
    UPDATE documents SET sync_status = 'deleted', updated_at = datetime('now')
    WHERE book_id = ? AND id NOT IN (${placeholders}) AND sync_status != 'deleted'
  `).run(bookId, ...existingIds)
  
  return result.changes
}

/**
 * Delete a document by ID
 */
export function deleteDocument(id: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM documents WHERE id = ?').run(id)
}

/**
 * Delete all documents for a book
 */
export function deleteDocumentsByBookId(bookId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM documents WHERE book_id = ?').run(bookId)
}

/**
 * Delete all documents
 */
export function deleteAllDocuments(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM documents').run()
}

/**
 * Get document count by status
 */
export function getDocumentCountByStatus(): Record<string, number> {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT sync_status, COUNT(*) as count FROM documents GROUP BY sync_status
  `).all() as { sync_status: string; count: number }[]
  
  const result: Record<string, number> = {
    synced: 0,
    pending: 0,
    modified: 0,
    new: 0,
    deleted: 0
  }
  
  for (const row of rows) {
    result[row.sync_status] = row.count
  }
  
  return result
}

/**
 * Get total document count
 */
export function getDocumentCount(): number {
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number }
  return result.count
}

/**
 * Search documents by title
 */
export function searchDocuments(query: string): DocumentRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM documents WHERE title LIKE ? ORDER BY title'
  ).all(`%${query}%`) as DocumentRecord[]
}
