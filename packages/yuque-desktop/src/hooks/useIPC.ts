import { useCallback, useEffect, useRef } from 'react'
import type { 
  IPCEventChannels,
  LoginCredentials,
  Session,
  KnowledgeBase,
  Document,
  SyncOptions,
  SyncStatus,
  ChangeSet,
  AppSettings,
  SyncProgress,
  SyncResult
} from '@electron/ipc/types'

// Re-export types for convenience
export type {
  LoginCredentials,
  Session,
  KnowledgeBase,
  Document,
  SyncOptions,
  SyncStatus,
  ChangeSet,
  AppSettings,
  SyncProgress,
  SyncResult
}

/**
 * Check if running in Electron environment
 */
export function useIsElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

/**
 * Hook for subscribing to IPC events from main process
 */
export function useIPCEvent<K extends keyof IPCEventChannels>(
  channel: K,
  callback: (data: IPCEventChannels[K]) => void
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return
    }

    const handler = (data: IPCEventChannels[K]) => {
      callbackRef.current(data)
    }

    const unsubscribe = window.electronAPI.on(channel, handler)
    return unsubscribe
  }, [channel])
}

// ============================================
// Specialized Hooks for Each Domain
// ============================================

/**
 * Authentication hooks
 */
export function useAuth() {
  const isElectron = useIsElectron()

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      if (!isElectron) throw new Error('Not in Electron environment')
      return window.electronAPI['auth:login'](credentials)
    },
    [isElectron]
  )

  const logout = useCallback(async () => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['auth:logout']()
  }, [isElectron])

  const getSession = useCallback(async (): Promise<Session | null> => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['auth:getSession']()
  }, [isElectron])

  return { login, logout, getSession, isElectron }
}

/**
 * Knowledge base hooks
 */
export function useBooks() {
  const isElectron = useIsElectron()

  const listBooks = useCallback(async (): Promise<KnowledgeBase[]> => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['books:list']()
  }, [isElectron])

  const getBookDocs = useCallback(
    async (bookId: string): Promise<Document[]> => {
      if (!isElectron) throw new Error('Not in Electron environment')
      return window.electronAPI['books:getDocs'](bookId)
    },
    [isElectron]
  )

  return { listBooks, getBookDocs, isElectron }
}

/**
 * Sync operation hooks
 */
export function useSync() {
  const isElectron = useIsElectron()

  const startSync = useCallback(
    async (options: SyncOptions): Promise<SyncResult> => {
      if (!isElectron) throw new Error('Not in Electron environment')
      return window.electronAPI['sync:start'](options)
    },
    [isElectron]
  )

  const cancelSync = useCallback(async (): Promise<void> => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['sync:cancel']()
  }, [isElectron])

  const getSyncStatus = useCallback(async (): Promise<SyncStatus> => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['sync:getStatus']()
  }, [isElectron])

  const getChanges = useCallback(
    async (bookIds: string[]): Promise<ChangeSet> => {
      if (!isElectron) throw new Error('Not in Electron environment')
      return window.electronAPI['sync:getChanges'](bookIds)
    },
    [isElectron]
  )

  return { startSync, cancelSync, getSyncStatus, getChanges, isElectron }
}

/**
 * Sync event subscription hook
 */
export function useSyncEvents(handlers: {
  onProgress?: (progress: SyncProgress) => void
  onComplete?: (result: SyncResult) => void
  onError?: (error: { message: string; code?: string }) => void
}) {
  useIPCEvent('sync:progress', (data) => {
    handlers.onProgress?.(data)
  })

  useIPCEvent('sync:complete', (data) => {
    handlers.onComplete?.(data)
  })

  useIPCEvent('sync:error', (data) => {
    handlers.onError?.(data)
  })
}

/**
 * Settings hooks
 */
export function useSettings() {
  const isElectron = useIsElectron()

  const getSettings = useCallback(async (): Promise<AppSettings> => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['settings:get']()
  }, [isElectron])

  const setSettings = useCallback(
    async (settings: Partial<AppSettings>): Promise<void> => {
      if (!isElectron) throw new Error('Not in Electron environment')
      return window.electronAPI['settings:set'](settings)
    },
    [isElectron]
  )

  const selectDirectory = useCallback(async (): Promise<string | null> => {
    if (!isElectron) throw new Error('Not in Electron environment')
    return window.electronAPI['settings:selectDirectory']()
  }, [isElectron])

  return { getSettings, setSettings, selectDirectory, isElectron }
}

/**
 * Generic IPC hook for advanced usage
 */
export function useIPC() {
  const isElectron = useIsElectron()
  return { isElectron }
}
