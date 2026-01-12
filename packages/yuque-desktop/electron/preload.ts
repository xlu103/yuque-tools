import { contextBridge, ipcRenderer } from 'electron'
import type { IPCChannels } from './ipc/types'

// Type-safe IPC invoke wrapper
type IPCInvokeAPI = {
  [K in keyof IPCChannels]: (...args: Parameters<IPCChannels[K]>) => ReturnType<IPCChannels[K]>
}

// Type-safe IPC event listener wrapper
type IPCEventAPI = {
  on: (channel: string, callback: (data: unknown) => void) => () => void
  off: (channel: string, callback: (data: unknown) => void) => void
}

// Create the API object
const electronAPI: IPCInvokeAPI & IPCEventAPI = {
  // Auth
  'auth:login': (credentials) => ipcRenderer.invoke('auth:login', credentials),
  'auth:logout': () => ipcRenderer.invoke('auth:logout'),
  'auth:getSession': () => ipcRenderer.invoke('auth:getSession'),

  // Knowledge Bases
  'books:list': () => ipcRenderer.invoke('books:list'),
  'books:getDocs': (bookId) => ipcRenderer.invoke('books:getDocs', bookId),
  'books:getLocalDocs': (bookId) => ipcRenderer.invoke('books:getLocalDocs', bookId),

  // Notes (小记)
  'notes:loadMore': (offset, limit) => ipcRenderer.invoke('notes:loadMore', offset, limit),
  'notes:getAllForSync': () => ipcRenderer.invoke('notes:getAllForSync'),

  // Sync
  'sync:start': (options) => ipcRenderer.invoke('sync:start', options),
  'sync:cancel': () => ipcRenderer.invoke('sync:cancel'),
  'sync:getStatus': () => ipcRenderer.invoke('sync:getStatus'),
  'sync:getChanges': (bookIds) => ipcRenderer.invoke('sync:getChanges', bookIds),
  'sync:getHistory': (limit) => ipcRenderer.invoke('sync:getHistory', limit),
  'sync:getFailedDocs': () => ipcRenderer.invoke('sync:getFailedDocs'),
  'sync:retryFailedDoc': (docId) => ipcRenderer.invoke('sync:retryFailedDoc', docId),
  'sync:clearFailedDoc': (docId) => ipcRenderer.invoke('sync:clearFailedDoc', docId),
  'sync:resetAllData': () => ipcRenderer.invoke('sync:resetAllData'),

  // Settings
  'settings:get': () => ipcRenderer.invoke('settings:get'),
  'settings:set': (settings) => ipcRenderer.invoke('settings:set', settings),
  'settings:selectDirectory': () => ipcRenderer.invoke('settings:selectDirectory'),

  // File operations
  'file:open': (filePath) => ipcRenderer.invoke('file:open', filePath),
  'file:openInYuque': (params) => ipcRenderer.invoke('file:openInYuque', params),
  'file:showInFolder': (filePath) => ipcRenderer.invoke('file:showInFolder', filePath),
  'file:readContent': (filePath) => ipcRenderer.invoke('file:readContent', filePath),
  'file:readImage': (filePath) => ipcRenderer.invoke('file:readImage', filePath),

  // Search
  'search:query': (query, options) => ipcRenderer.invoke('search:query', query, options),

  // Resume sync (断点续传)
  'sync:getInterruptedSession': () => ipcRenderer.invoke('sync:getInterruptedSession'),
  'sync:clearInterruptedSession': (sessionId) => ipcRenderer.invoke('sync:clearInterruptedSession', sessionId),

  // Statistics (统计)
  'stats:get': () => ipcRenderer.invoke('stats:get'),

  // Window operations
  'window:expandWidth': (additionalWidth) => ipcRenderer.invoke('window:expandWidth', additionalWidth),

  // Event listeners
  on: (channel, callback) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data)
    }
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback as (...args: unknown[]) => void)
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
