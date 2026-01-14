import { create } from 'zustand'

const STORAGE_KEY = 'yuque-reading-history'
const MAX_HISTORY = 20

export interface ReadingHistoryItem {
  filePath: string
  title: string
  bookId?: string
  bookName?: string
  timestamp: number
}

interface ReadingHistoryState {
  history: ReadingHistoryItem[]
  addToHistory: (item: Omit<ReadingHistoryItem, 'timestamp'>) => void
  clearHistory: () => void
  loadHistory: () => void
}

export const useReadingHistoryStore = create<ReadingHistoryState>((set, get) => ({
  history: [],

  addToHistory: (item) => {
    const { history } = get()
    // 移除重复项
    const filtered = history.filter(h => h.filePath !== item.filePath)
    // 添加到开头
    const newHistory = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY)
    set({ history: newHistory })
    // 保存到 localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
    } catch {}
  },

  clearHistory: () => {
    set({ history: [] })
    localStorage.removeItem(STORAGE_KEY)
  },

  loadHistory: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        set({ history: JSON.parse(saved) })
      }
    } catch {}
  }
}))
