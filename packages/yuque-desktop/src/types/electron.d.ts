import type { IPCChannels, IPCEventChannels } from '@electron/ipc/types'

// Type-safe IPC invoke API
type IPCInvokeAPI = {
  [K in keyof IPCChannels]: (...args: Parameters<IPCChannels[K]>) => ReturnType<IPCChannels[K]>
}

// Type-safe IPC event listener API
type IPCEventAPI = {
  on: <K extends keyof IPCEventChannels>(
    channel: K,
    callback: (data: IPCEventChannels[K]) => void
  ) => () => void
  off: <K extends keyof IPCEventChannels>(
    channel: K,
    callback: (data: IPCEventChannels[K]) => void
  ) => void
}

declare global {
  interface Window {
    electronAPI: IPCInvokeAPI & IPCEventAPI
  }
}

export {}
