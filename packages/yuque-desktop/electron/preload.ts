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

  // Sync
  'sync:start': (options) => ipcRenderer.invoke('sync:start', options),
  'sync:cancel': () => ipcRenderer.invoke('sync:cancel'),
  'sync:getStatus': () => ipcRenderer.invoke('sync:getStatus'),
  'sync:getChanges': (bookIds) => ipcRenderer.invoke('sync:getChanges', bookIds),
  'sync:getHistory': (limit) => ipcRenderer.invoke('sync:getHistory', limit),

  // Settings
  'settings:get': () => ipcRenderer.invoke('settings:get'),
  'settings:set': (settings) => ipcRenderer.invoke('settings:set', settings),
  'settings:selectDirectory': () => ipcRenderer.invoke('settings:selectDirectory'),

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
