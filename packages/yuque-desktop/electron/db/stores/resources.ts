/**
 * Resources Store
 * CRUD operations for image and attachment resources
 */

import { getDatabase } from '../index'
import type { ResourceRecord, ResourceInput, ResourceUpdate } from './types'

/**
 * Create a new resource record
 * Returns the ID of the created resource
 */
export function createResource(input: ResourceInput): number {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO resources (doc_id, type, remote_url, local_path, filename, size_bytes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.docId,
    input.type,
    input.remoteUrl,
    input.localPath ?? null,
    input.filename ?? null,
    input.sizeBytes ?? null,
    input.status ?? 'pending'
  )
  
  return result.lastInsertRowid as number
}

/**
 * Create multiple resource records
 */
export function createResources(inputs: ResourceInput[]): void {
  const db = getDatabase()
  const insert = db.prepare(`
    INSERT INTO resources (doc_id, type, remote_url, local_path, filename, size_bytes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  
  const insertMany = db.transaction((items: ResourceInput[]) => {
    for (const input of items) {
      insert.run(
        input.docId,
        input.type,
        input.remoteUrl,
        input.localPath ?? null,
        input.filename ?? null,
        input.sizeBytes ?? null,
        input.status ?? 'pending'
      )
    }
  })
  
  insertMany(inputs)
}

/**
 * Get a resource by ID
 */
export function getResourceById(id: number): ResourceRecord | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRecord | undefined
}

/**
 * Get resources by document ID
 */
export function getResourcesByDocId(docId: string): ResourceRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM resources WHERE doc_id = ? ORDER BY id'
  ).all(docId) as ResourceRecord[]
}

/**
 * Get resources by document ID and type
 */
export function getResourcesByDocIdAndType(
  docId: string, 
  type: 'image' | 'attachment'
): ResourceRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM resources WHERE doc_id = ? AND type = ? ORDER BY id'
  ).all(docId, type) as ResourceRecord[]
}

/**
 * Get resource by remote URL
 */
export function getResourceByUrl(remoteUrl: string): ResourceRecord | undefined {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM resources WHERE remote_url = ?'
  ).get(remoteUrl) as ResourceRecord | undefined
}

/**
 * Get pending resources for a document
 */
export function getPendingResources(docId: string): ResourceRecord[] {
  const db = getDatabase()
  return db.prepare(
    "SELECT * FROM resources WHERE doc_id = ? AND status = 'pending' ORDER BY id"
  ).all(docId) as ResourceRecord[]
}

/**
 * Get all pending resources
 */
export function getAllPendingResources(): ResourceRecord[] {
  const db = getDatabase()
  return db.prepare(
    "SELECT * FROM resources WHERE status = 'pending' ORDER BY id"
  ).all() as ResourceRecord[]
}

/**
 * Update a resource
 */
export function updateResource(id: number, update: ResourceUpdate): void {
  const db = getDatabase()
  const sets: string[] = []
  const values: (string | number | null)[] = []

  if (update.localPath !== undefined) {
    sets.push('local_path = ?')
    values.push(update.localPath)
  }
  if (update.filename !== undefined) {
    sets.push('filename = ?')
    values.push(update.filename)
  }
  if (update.sizeBytes !== undefined) {
    sets.push('size_bytes = ?')
    values.push(update.sizeBytes)
  }
  if (update.status !== undefined) {
    sets.push('status = ?')
    values.push(update.status)
  }

  if (sets.length === 0) return

  values.push(id)
  db.prepare(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

/**
 * Mark resource as downloaded
 */
export function markResourceDownloaded(
  id: number, 
  localPath: string, 
  filename: string, 
  sizeBytes: number
): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE resources 
    SET local_path = ?, filename = ?, size_bytes = ?, status = 'downloaded'
    WHERE id = ?
  `).run(localPath, filename, sizeBytes, id)
}

/**
 * Mark resource as failed
 */
export function markResourceFailed(id: number): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE resources SET status = 'failed' WHERE id = ?
  `).run(id)
}

/**
 * Delete resources by document ID
 */
export function deleteResourcesByDocId(docId: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM resources WHERE doc_id = ?').run(docId)
}

/**
 * Delete a resource by ID
 */
export function deleteResource(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM resources WHERE id = ?').run(id)
}

/**
 * Get resource statistics
 */
export function getResourceStatistics(): {
  totalImages: number
  downloadedImages: number
  totalAttachments: number
  downloadedAttachments: number
  totalSizeBytes: number
} {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT 
      SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) as total_images,
      SUM(CASE WHEN type = 'image' AND status = 'downloaded' THEN 1 ELSE 0 END) as downloaded_images,
      SUM(CASE WHEN type = 'attachment' THEN 1 ELSE 0 END) as total_attachments,
      SUM(CASE WHEN type = 'attachment' AND status = 'downloaded' THEN 1 ELSE 0 END) as downloaded_attachments,
      COALESCE(SUM(size_bytes), 0) as total_size_bytes
    FROM resources
  `).get() as {
    total_images: number
    downloaded_images: number
    total_attachments: number
    downloaded_attachments: number
    total_size_bytes: number
  }

  return {
    totalImages: row.total_images ?? 0,
    downloadedImages: row.downloaded_images ?? 0,
    totalAttachments: row.total_attachments ?? 0,
    downloadedAttachments: row.downloaded_attachments ?? 0,
    totalSizeBytes: row.total_size_bytes ?? 0
  }
}

/**
 * Check if a resource URL already exists for a document
 */
export function resourceExists(docId: string, remoteUrl: string): boolean {
  const db = getDatabase()
  const row = db.prepare(
    'SELECT 1 FROM resources WHERE doc_id = ? AND remote_url = ?'
  ).get(docId, remoteUrl)
  return !!row
}
