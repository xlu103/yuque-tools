/**
 * Sync Sessions Store
 * CRUD operations for sync session records (断点续传)
 */

import { getDatabase } from '../index'
import type { SyncSessionRecord, SyncSessionInput, SyncSessionUpdate } from './types'

/**
 * Create a new sync session
 * Returns the ID of the created session
 */
export function createSyncSession(input: SyncSessionInput): number {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO sync_sessions (book_ids, total_docs, completed_doc_ids, status)
    VALUES (?, ?, '[]', 'running')
  `).run(JSON.stringify(input.bookIds), input.totalDocs)
  
  return result.lastInsertRowid as number
}

/**
 * Get a sync session by ID
 */
export function getSyncSessionById(id: number): SyncSessionRecord | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM sync_sessions WHERE id = ?').get(id) as SyncSessionRecord | undefined
}

/**
 * Get the latest interrupted sync session
 */
export function getInterruptedSession(): SyncSessionRecord | undefined {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM sync_sessions 
    WHERE status = 'interrupted' 
    ORDER BY updated_at DESC 
    LIMIT 1
  `).get() as SyncSessionRecord | undefined
}

/**
 * Get the current running sync session
 */
export function getRunningSession(): SyncSessionRecord | undefined {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM sync_sessions 
    WHERE status = 'running' 
    ORDER BY started_at DESC 
    LIMIT 1
  `).get() as SyncSessionRecord | undefined
}

/**
 * Mark a document as completed in a sync session
 */
export function markDocCompleted(sessionId: number, docId: string): void {
  const db = getDatabase()
  const session = getSyncSessionById(sessionId)
  if (!session) return
  
  const completedIds: string[] = JSON.parse(session.completed_doc_ids)
  if (!completedIds.includes(docId)) {
    completedIds.push(docId)
  }
  
  db.prepare(`
    UPDATE sync_sessions 
    SET completed_doc_ids = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(completedIds), sessionId)
}

/**
 * Update sync session status
 */
export function updateSyncSessionStatus(
  sessionId: number, 
  status: 'running' | 'interrupted' | 'completed'
): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE sync_sessions 
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, sessionId)
}

/**
 * Get completed document IDs for a session
 */
export function getCompletedDocIds(sessionId: number): string[] {
  const session = getSyncSessionById(sessionId)
  if (!session) return []
  return JSON.parse(session.completed_doc_ids)
}

/**
 * Get book IDs for a session
 */
export function getSessionBookIds(sessionId: number): string[] {
  const session = getSyncSessionById(sessionId)
  if (!session) return []
  return JSON.parse(session.book_ids)
}

/**
 * Delete a sync session
 */
export function deleteSyncSession(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sync_sessions WHERE id = ?').run(id)
}

/**
 * Delete old completed sessions (keep only recent N)
 */
export function pruneOldSessions(keepCount: number = 10): number {
  const db = getDatabase()
  const result = db.prepare(`
    DELETE FROM sync_sessions 
    WHERE status = 'completed' AND id NOT IN (
      SELECT id FROM sync_sessions 
      WHERE status = 'completed' 
      ORDER BY updated_at DESC 
      LIMIT ?
    )
  `).run(keepCount)
  
  return result.changes
}

/**
 * Mark all running sessions as interrupted (called on app startup)
 */
export function markRunningSessonsAsInterrupted(): number {
  const db = getDatabase()
  const result = db.prepare(`
    UPDATE sync_sessions 
    SET status = 'interrupted', updated_at = datetime('now')
    WHERE status = 'running'
  `).run()
  
  return result.changes
}
