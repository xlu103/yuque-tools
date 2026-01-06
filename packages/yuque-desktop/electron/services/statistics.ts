/**
 * Statistics Service
 * Provides statistics about synced documents, books, and storage
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
 */

import * as fs from 'fs'
import * as path from 'path'
import { getDocumentCount, getDocumentCountByStatus } from '../db/stores/documents'
import { getBookCount } from '../db/stores/books'
import { getLastSuccessfulSyncTime } from '../db/stores/syncHistory'
import { getResourceStatistics } from '../db/stores/resources'
import { getAppSettings } from '../db/stores/settings'

/**
 * Statistics data structure
 */
export interface SyncStatistics {
  // Document counts (Requirements: 7.1, 7.4)
  totalDocuments: number
  syncedDocuments: number
  failedDocuments: number
  pendingDocuments: number
  newDocuments: number
  modifiedDocuments: number
  deletedDocuments: number
  
  // Book count (Requirements: 7.2)
  totalBooks: number
  
  // Storage (Requirements: 7.3)
  totalStorageBytes: number
  
  // Last sync time (Requirements: 7.6)
  lastSyncTime: string | null
  
  // Resource counts
  imageCount: number
  attachmentCount: number
}

/**
 * Calculate directory size recursively
 * Requirements: 7.3
 */
export function calculateDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0
  }

  let totalSize = 0

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        totalSize += calculateDirectorySize(fullPath)
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath)
          totalSize += stats.size
        } catch {
          // Skip files that can't be accessed
        }
      }
    }
  } catch {
    // Return 0 if directory can't be read
    return 0
  }

  return totalSize
}

/**
 * Get complete sync statistics
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
 */
export function getStatistics(): SyncStatistics {
  // Get document counts by status (Requirements: 7.1, 7.4)
  const statusCounts = getDocumentCountByStatus()
  const totalDocuments = getDocumentCount()
  
  // Get book count (Requirements: 7.2)
  const totalBooks = getBookCount()
  
  // Get last sync time (Requirements: 7.6)
  const lastSyncTime = getLastSuccessfulSyncTime()
  
  // Get resource statistics
  const resourceStats = getResourceStatistics()
  
  // Calculate storage size (Requirements: 7.3)
  const settings = getAppSettings()
  const syncDirectory = settings.syncDirectory
  const totalStorageBytes = syncDirectory ? calculateDirectorySize(syncDirectory) : 0
  
  return {
    totalDocuments,
    syncedDocuments: statusCounts.synced || 0,
    failedDocuments: statusCounts.failed || 0,
    pendingDocuments: statusCounts.pending || 0,
    newDocuments: statusCounts.new || 0,
    modifiedDocuments: statusCounts.modified || 0,
    deletedDocuments: statusCounts.deleted || 0,
    totalBooks,
    totalStorageBytes,
    lastSyncTime,
    imageCount: resourceStats.downloadedImages,
    attachmentCount: resourceStats.downloadedAttachments
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${size.toFixed(i > 0 ? 2 : 0)} ${units[i]}`
}
