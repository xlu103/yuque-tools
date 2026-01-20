import { create } from 'zustand'

const STORAGE_KEY = 'yuque-search-history'
const MAX_HISTORY = 10

interface SearchHistoryState {
  history: string[]
  addToHistory: (query: string) => void
  removeFromHistory: (query: string) => void
  clearHistory: () => void
  loadHistory: () => void
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  history: [],

  addToHistory: (query) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return
    
    const { history } = get()
    // Remove duplicate if exists
    const filtered = history.filter(h => h !== trimmedQuery)
    // Add to beginning
    const newHistory = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY)
    set({ history: newHistory })
    
    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  },

  removeFromHistory: (query) => {
    const { history } = get()
    const newHistory = history.filter(h => h !== query)
    set({ history: newHistory })
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory))
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  },

  clearHistory: () => {
    set({ history: [] })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear search history:', error)
    }
  },

  loadHistory: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const history = JSON.parse(saved)
        set({ history: Array.isArray(history) ? history : [] })
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
    }
  }
}))
