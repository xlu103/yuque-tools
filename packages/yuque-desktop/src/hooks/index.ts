// IPC Hooks
export {
  useIPC,
  useIPCEvent,
  useIsElectron,
  useAuth,
  useBooks,
  useSync,
  useSyncEvents,
  useSettings
} from './useIPC'

// Theme Hook
export { useTheme } from './useTheme'

// Utility Hooks
export { useDebounce } from './useDebounce'

// Re-export Toast hook from UI
export { useToast } from '../components/ui/MacToast'

// Re-export types
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
} from './useIPC'
