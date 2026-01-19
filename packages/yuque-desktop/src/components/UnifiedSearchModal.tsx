import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { KnowledgeBase, SearchResult } from '../hooks'
import { useSearch } from '../hooks'
import { useBookOrganizeStore } from '../stores'
import type { BookSortType } from '../stores/bookOrganizeStore'

interface UnifiedSearchModalProps {
  books: KnowledgeBase[]
  onClose: () => void
  onSelectBook: (bookId: string) => void
  onSelectDocument: (result: SearchResult) => void
}

type SearchScope = 'all' | 'books' | 'documents'

export function UnifiedSearchModal({ books, onClose, onSelectBook, onSelectDocument }: UnifiedSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('all')
  const [isSearching, setIsSearching] = useState(false)
  const [documentResults, setDocumentResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const { search } = useSearch()
  const {
    sortType,
    setSortType,
    getLastAccessed,
    isHidden
  } = useBookOrganizeStore()

  // Filter and sort books based on search query
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim() || searchScope === 'documents') return []
    
    const query = searchQuery.toLowerCase()
    const filtered = books.filter(book => {
      if (isHidden(book.id)) return false
      return book.name.toLowerCase().includes(query)
    })

    // Sort books
    filtered.sort((a, b) => {
      switch (sortType) {
        case 'name':
          return a.name.localeCompare(b.name, 'zh-CN')
        case 'docCount':
          return (b.docCount || 0) - (a.docCount || 0)
        case 'lastAccessed':
        default:
          const timeA = getLastAccessed(a.id)
          const timeB = getLastAccessed(b.id)
          if (timeA === 0 && timeB === 0) {
            return a.name.localeCompare(b.name, 'zh-CN')
          }
          if (timeA === 0) return 1
          if (timeB === 0) return -1
          return timeB - timeA
      }
    })

    return filtered
  }, [books, searchQuery, searchScope, sortType, getLastAccessed, isHidden])

  // Search documents
  useEffect(() => {
    if (!searchQuery.trim() || searchScope === 'books') {
      setDocumentResults([])
      return
    }

    const searchDocuments = async () => {
      setIsSearching(true)
      try {
        const results = await search(searchQuery.trim(), { limit: 20, searchContent: true })
        setDocumentResults(results)
      } catch (error) {
        console.error('Search failed:', error)
        setDocumentResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(searchDocuments, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchScope, search])

  // Calculate total results
  const totalResults = useMemo(() => {
    const bookCount = searchScope !== 'documents' ? filteredBooks.length : 0
    const docCount = searchScope !== 'books' ? documentResults.length : 0
    return bookCount + docCount
  }, [filteredBooks, documentResults, searchScope])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredBooks, documentResults, searchScope])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, totalResults - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && totalResults > 0) {
        e.preventDefault()
        handleSelectResult(selectedIndex)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, totalResults, onClose])

  // Auto focus search input
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const handleSelectResult = useCallback((index: number) => {
    const bookCount = searchScope !== 'documents' ? filteredBooks.length : 0
    
    if (index < bookCount) {
      // Select book
      const book = filteredBooks[index]
      onSelectBook(book.id)
      onClose()
    } else {
      // Select document
      const docIndex = index - bookCount
      const doc = documentResults[docIndex]
      if (doc) {
        onSelectDocument(doc)
        onClose()
      }
    }
  }, [filteredBooks, documentResults, searchScope, onSelectBook, onSelectDocument, onClose])

  const handleReset = useCallback(() => {
    setSearchQuery('')
    setSortType('lastAccessed')
    setSearchScope('all')
  }, [setSortType])

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary border border-border rounded-xl shadow-2xl w-[600px] max-w-[90vw] max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识库和文档..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-text-quaternary">
              ⌘K
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          {/* Scope tabs */}
          <div className="flex items-center gap-1 bg-bg-secondary rounded-md p-0.5">
            <button
              onClick={() => setSearchScope('all')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                searchScope === 'all'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setSearchScope('books')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                searchScope === 'books'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              知识库
            </button>
            <button
              onClick={() => setSearchScope('documents')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                searchScope === 'documents'
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              文档
            </button>
          </div>

          <div className="flex-1" />

          {/* Sort buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortType('lastAccessed')}
              title="按访问时间"
              className={`p-1.5 rounded transition-colors ${
                sortType === 'lastAccessed'
                  ? 'bg-accent text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setSortType('name')}
              title="按名称"
              className={`p-1.5 rounded transition-colors ${
                sortType === 'name'
                  ? 'bg-accent text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
            <button
              onClick={() => setSortType('docCount')}
              title="按文档数"
              className={`p-1.5 rounded transition-colors ${
                sortType === 'docCount'
                  ? 'bg-accent text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {!searchQuery ? (
            <div className="p-8 text-center text-text-secondary text-sm">
              输入关键词开始搜索...
            </div>
          ) : isSearching ? (
            <div className="p-8 text-center text-text-secondary text-sm">
              搜索中...
            </div>
          ) : totalResults === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm">
              未找到匹配结果
            </div>
          ) : (
            <div>
              {/* Books section */}
              {searchScope !== 'documents' && filteredBooks.length > 0 && (
                <div className="border-b border-border-light">
                  <div className="px-4 py-2 text-xs text-text-tertiary font-medium bg-bg-secondary">
                    📚 知识库 ({filteredBooks.length})
                  </div>
                  {filteredBooks.map((book, index) => (
                    <div
                      key={book.id}
                      className={`px-4 py-3 cursor-pointer transition-colors ${
                        index === selectedIndex
                          ? 'bg-accent/10'
                          : 'hover:bg-bg-secondary'
                      }`}
                      onClick={() => handleSelectResult(index)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">
                          {book.type === 'owner' ? '👤' : '👥'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary font-medium truncate">
                            {book.name}
                          </div>
                          <div className="text-xs text-text-tertiary">
                            {book.docCount} 个文档
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Documents section */}
              {searchScope !== 'books' && documentResults.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs text-text-tertiary font-medium bg-bg-secondary">
                    📄 文档 ({documentResults.length})
                  </div>
                  {documentResults.map((result, index) => {
                    const resultIndex = searchScope !== 'documents' ? filteredBooks.length + index : index
                    return (
                      <div
                        key={`${result.docId}-${result.matchType}`}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          resultIndex === selectedIndex
                            ? 'bg-accent/10'
                            : 'hover:bg-bg-secondary'
                        }`}
                        onClick={() => handleSelectResult(resultIndex)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            result.matchType === 'title'
                              ? 'bg-accent/10 text-accent'
                              : 'bg-green-500/10 text-green-600'
                          }`}>
                            {result.matchType === 'title' ? '标题' : '内容'}
                          </span>
                          <span className="text-sm text-text-primary font-medium truncate flex-1">
                            {result.title}
                          </span>
                        </div>
                        <div className="text-xs text-text-tertiary truncate">
                          📚 {result.bookName}
                        </div>
                        {result.snippet && (
                          <div className="text-xs text-text-tertiary mt-1 line-clamp-2">
                            {result.snippet}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-between items-center bg-bg-secondary">
          <div className="text-xs text-text-tertiary">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-[10px] border border-border">↑↓</kbd>
              选择
            </span>
            <span className="inline-flex items-center gap-1 ml-3">
              <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-[10px] border border-border">Enter</kbd>
              打开
            </span>
            <span className="inline-flex items-center gap-1 ml-3">
              <kbd className="px-1 py-0.5 bg-bg-tertiary rounded text-[10px] border border-border">ESC</kbd>
              关闭
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  )
}
