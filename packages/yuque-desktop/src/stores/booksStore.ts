import { create } from 'zustand'
import type { KnowledgeBase, Document } from '../hooks'

interface BooksState {
  books: KnowledgeBase[]
  selectedBookId: string | null
  documents: Map<string, Document[]>
  isLoadingBooks: boolean
  isLoadingDocs: boolean
  
  setBooks: (books: KnowledgeBase[]) => void
  setSelectedBookId: (id: string | null) => void
  setDocuments: (bookId: string, docs: Document[]) => void
  setLoadingBooks: (loading: boolean) => void
  setLoadingDocs: (loading: boolean) => void
  getDocumentsForBook: (bookId: string) => Document[]
  clearAll: () => void
}

export const useBooksStore = create<BooksState>((set, get) => ({
  books: [],
  selectedBookId: null,
  documents: new Map(),
  isLoadingBooks: false,
  isLoadingDocs: false,
  
  setBooks: (books) => set({ books }),
  setSelectedBookId: (selectedBookId) => set({ selectedBookId }),
  setDocuments: (bookId, docs) => set((state) => {
    const newDocs = new Map(state.documents)
    newDocs.set(bookId, docs)
    return { documents: newDocs }
  }),
  setLoadingBooks: (isLoadingBooks) => set({ isLoadingBooks }),
  setLoadingDocs: (isLoadingDocs) => set({ isLoadingDocs }),
  getDocumentsForBook: (bookId) => get().documents.get(bookId) || [],
  clearAll: () => set({ books: [], selectedBookId: null, documents: new Map() })
}))
