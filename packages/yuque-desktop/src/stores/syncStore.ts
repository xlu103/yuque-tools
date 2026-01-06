import { create } from 'zustand'
import type { SyncProgress, ChangeSet } from '../hooks'

interface SyncState {
  isRunning: boolean
  progress: SyncProgress | null
  changes: ChangeSet | null
  selectedDocIds: Set<string>
  
  setRunning: (running: boolean) => void
  setProgress: (progress: SyncProgress | null) => void
  setChanges: (changes: ChangeSet | null) => void
  toggleDocSelection: (docId: string) => void
  selectAllDocs: (docIds: string[]) => void
  clearSelection: () => void
  reset: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isRunning: false,
  progress: null,
  changes: null,
  selectedDocIds: new Set(),
  
  setRunning: (isRunning) => set({ isRunning }),
  setProgress: (progress) => set({ progress }),
  setChanges: (changes) => set({ changes }),
  toggleDocSelection: (docId) => set((state) => {
    const newSet = new Set(state.selectedDocIds)
    if (newSet.has(docId)) {
      newSet.delete(docId)
    } else {
      newSet.add(docId)
    }
    return { selectedDocIds: newSet }
  }),
  selectAllDocs: (docIds) => set({ selectedDocIds: new Set(docIds) }),
  clearSelection: () => set({ selectedDocIds: new Set() }),
  reset: () => set({ isRunning: false, progress: null, changes: null, selectedDocIds: new Set() })
}))
