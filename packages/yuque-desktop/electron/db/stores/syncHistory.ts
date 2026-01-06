/**
 * Sync History Store
 * CRUD operations for sync history records
 */

import { getDatabase } from '../index'
import type { SyncHistoryRecord, SyncHistoryInput, SyncHistoryUpdate } from './types'

/**
 * Create a new sync history record
 * Returns the ID of the created record
 */
export function createSyncHistory(input?: SyncHistoryInput): number {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO sync_history (total_docs, status)
    VALUES (?, 'running')
  `).run(input?.totalDocs ?? 0)
  
  return result.lastInsertRowid as number
}

/**
 * Get a sync history record by ID
 */
export function getSyncHistoryById(id: number): SyncHistoryRecord | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM sync_history WHERE id = ?').get(id) as SyncHistoryRecord | undefined
}

/**
 * Get recent sync history records
 */
export function getRecentSyncHistory(limit: number = 50): SyncHistoryRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM sync_history ORDER BY started_at DESC LIMIT ?'
  ).all(limit) as SyncHistoryRecord[]
}

/**
 * Get sync history by status
 */
export function getSyncHistoryByStatus(
  status: 'running' | 'success' | 'failed' | 'cancelled'
): SyncHistoryRecord[] {
  const db = getDatabase()
  return db.prepare(
    'SELECT * FROM sync_history WHERE status = ? ORDER BY started_at DESC'
  ).all(status) as SyncHistoryRecord[]
}

/**
 * Update a sync history record
 */
export function updateSyncHistory(id: number, update: SyncHistoryUpdate): void {
  const db = getDatabase()
  const sets: string[] = []
  const values: (string | number | null)[] = []

  if (update.completedAt !== undefined) {
    sets.push('completed_at = ?')
    values.push(update.completedAt)
  }
  if (update.status !== undefined) {
    sets.push('status = ?')
    values.push(update.status)
  }
  if (update.syncedDocs !== undefined) {
    sets.push('synced_docs = ?')
    values.push(update.syncedDocs)
  }
  if (update.failedDocs !== undefined) {
    sets.push('failed_docs = ?')
    values.push(update.failedDocs)
  }
  if (update.errorMessage !== undefined) {
    sets.push('error_message = ?')
    values.push(update.errorMessage)
  }

  if (sets.length === 0) return

  values.push(id)
  db.prepare(`UPDATE sync_history SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

/**
 * Complete a sync history record with success
 */
export function completeSyncHistorySuccess(id: number, syncedDocs: number): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE sync_history 
    SET completed_at = datetime('now'), status = 'success', synced_docs = ?
    WHERE id = ?
  `).run(syncedDocs, id)
}

/**
 * Complete a sync history record with failure
 */
export function completeSyncHistoryFailed(id: number, errorMessage: string, syncedDocs?: number, failedDocs?: number): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE sync_history 
    SET completed_at = datetime('now'), status = 'failed', error_message = ?, synced_docs = ?, failed_docs = ?
    WHERE id = ?
  `).run(errorMessage, syncedDocs ?? 0, failedDocs ?? 0, id)
}

/**
 * Cancel a sync history record
 */
export function cancelSyncHistory(id: number, syncedDocs?: number): void {
  const db = getDatabase()
  db.prepare(`
    UPDATE sync_history 
    SET completed_at = datetime('now'), status = 'cancelled', synced_docs = ?
    WHERE id = ?
  `).run(syncedDocs ?? 0, id)
}

/**
 * Delete a sync history record
 */
export function deleteSyncHistory(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sync_history WHERE id = ?').run(id)
}

/**
 * Delete old sync history records (keep only recent N records)
 */
export function pruneOldSyncHistory(keepCount: number = 50): number {
  const db = getDatabase()
  const result = db.prepare(`
    DELETE FROM sync_history 
    WHERE id NOT IN (
      SELECT id FROM sync_history ORDER BY started_at DESC LIMIT ?
    )
  `).run(keepCount)
  
  return result.changes
}

/**
 * Delete all sync history
 */
export function deleteAllSyncHistory(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sync_history').run()
}

/**
 * Get the last successful sync time
 */
export function getLastSuccessfulSyncTime(): string | null {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT completed_at FROM sync_history 
    WHERE status = 'success' 
    ORDER BY completed_at DESC 
    LIMIT 1
  `).get() as { completed_at: string } | undefined
  
  return row?.completed_at ?? null
}

/**
 * Get sync statistics
 */
export function getSyncStatistics(): {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  totalDocsSynced: number
} {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT 
      COUNT(*) as total_syncs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
      SUM(synced_docs) as total_docs_synced
    FROM sync_history
  `).get() as {
    total_syncs: number
    successful_syncs: number
    failed_syncs: number
    total_docs_synced: number
  }

  return {
    totalSyncs: row.total_syncs,
    successfulSyncs: row.successful_syncs ?? 0,
    failedSyncs: row.failed_syncs ?? 0,
    totalDocsSynced: row.total_docs_synced ?? 0
  }
}
