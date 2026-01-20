import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { KnowledgeBase, SearchResult } from '../hooks'
import { useSearch } from '../hooks'
import { useBookOrganizeStore, useSearchHistoryStore } from '../stores'
import type { BookSortType } from '../stores/bookOrganizeStore'

interface UnifiedSearchModalProps {
  books: KnowledgeBase[]
  onClose: () => void
  onSelectBook: (bookId: string) => void
  onSelectDocument: (result: SearchResult) => void
  onPreviewDocument?: (result: SearchResult) => void
}

type SearchScope = 'all' | 'books' | 'documents'

export function UnifiedSearchModal({ books, onClose, onSelectBook, onSelectDocument, onPreviewDocument }: UnifiedSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('all')
  const [isSearching, setIsSearching] = useState(false)
  const [documentResults, setDocumentResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  
  const { search } = useSearch()
  const {
    sortType,
    setSortType,
    getLastAccessed,
    isHidden
  } = useBookOrganizeStore()
  
  const {
    history: searchHistory,
    addToHistory: addSearchToHistory,
    removeFromHistory: removeSearchFromHistory,
    clearHistory: clearSearchHistory,
    loadHistory: loadSearchHistory
  } = useSearchHistoryStore()
  
  // Load search history on mount
  useEffect(() => {
    loadSearchHistory()
  }, [loadSearchHistory])

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
        // Add to search history when search completes successfully
        if (results.length > 0) {
          addSearchToHistory(searchQuery.trim())
        }
      } catch (error) {
        console.error('Search failed:', error)
        setDocumentResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(searchDocuments, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchScope, search, addSearchToHistory])
  
  // Add to search history when book search has results
  useEffect(() => {
    if (searchQuery.trim() && filteredBooks.length > 0 && searchScope !== 'documents') {
      addSearchToHistory(searchQuery.trim())
    }
  }, [filteredBooks, searchQuery, searchScope, addSearchToHistory])

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

  // Preview document when selection changes (only for documents with localPath)
  useEffect(() => {
    if (!onPreviewDocument) return
    
    const bookCount = searchScope !== 'documents' ? filteredBooks.length : 0
    
    // Only preview if selected index is in document results range
    if (selectedIndex >= bookCount) {
      const docIndex = selectedIndex - bookCount
      const doc = documentResults[docIndex]
      if (doc && doc.localPath) {
        onPreviewDocument(doc)
      }
    }
  }, [selectedIndex, filteredBooks, documentResults, searchScope, onPreviewDocument])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if no results
      if (totalResults === 0) return

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

    // Add listener to window to capture all keyboard events
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
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
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-start justify-center pt-16 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary border border-border rounded-2xl shadow-2xl w-[640px] max-w-[90vw] max-h-[75vh] overflow-hidden flex flex-col animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-5 border-b border-border">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识库和文档..."
              className="w-full pl-12 pr-20 py-3 text-base bg-bg-secondary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-bg-tertiary rounded text-xs text-text-quaternary font-mono border border-border">
              ⌘K
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 bg-bg-secondary/50">
          {/* Scope tabs */}
          <div className="flex items-center gap-1 bg-bg-primary rounded-lg p-1 border border-border">
            <button
              onClick={() => setSearchScope('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                searchScope === 'all'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setSearchScope('books')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                searchScope === 'books'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              知识库
            </button>
            <button
              onClick={() => setSearchScope('documents')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                searchScope === 'documents'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              文档
            </button>
          </div>

          <div className="flex-1" />

          {/* Sort buttons */}
          <div className="flex items-center gap-0.5 bg-bg-primary rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setSortType('lastAccessed')}
              title="按访问时间"
              className={`p-2 rounded-md transition-all ${
                sortType === 'lastAccessed'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setSortType('name')}
              title="按名称"
              className={`p-2 rounded-md transition-all ${
                sortType === 'name'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
            <button
              onClick={() => setSortType('docCount')}
              title="按文档数"
              className={`p-2 rounded-md transition-all ${
                sortType === 'docCount'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={resultsContainerRef} className="flex-1 overflow-auto">
          {!searchQuery ? (
            <div className="p-6">
              {/* Search history */}
              {searchHistory.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-text-secondary">搜索历史</h3>
                    <button
                      onClick={clearSearchHistory}
                      className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      清空
                    </button>
                  </div>
                  <div className="space-y-1">
                    {searchHistory.map((query, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors group"
                      >
                        <svg className="w-4 h-4 text-text-tertiary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <button
                          onClick={() => setSearchQuery(query)}
                          className="flex-1 text-left text-sm text-text-primary hover:text-accent transition-colors"
                        >
                          {query}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeSearchFromHistory(query)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-error transition-all"
                          title="删除"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="w-16 h-16 text-text-quaternary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm text-text-secondary">输入关键词开始搜索</p>
                  <p className="text-xs text-text-tertiary mt-2">支持搜索知识库名称和文档内容</p>
                </div>
              )}
            </div>
          ) : isSearching ? (
            <div className="flex flex-col items-center justify-center h-full p-12">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-text-secondary">搜索中...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
              <svg className="w-16 h-16 text-text-quaternary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-text-secondary">未找到匹配结果</p>
              <p className="text-xs text-text-tertiary mt-2">试试其他关键词</p>
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
                      ref={index === selectedIndex ? selectedItemRef : null}
                      className={`px-4 py-3 cursor-pointer transition-all border-b border-border-light last:border-b-0 ${
                        index === selectedIndex
                          ? 'bg-accent/15 border-l-4 border-l-accent shadow-sm'
                          : 'hover:bg-bg-secondary border-l-4 border-l-transparent'
                      }`}
                      onClick={() => handleSelectResult(index)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          index === selectedIndex ? 'bg-accent/20' : 'bg-bg-tertiary'
                        }`}>
                          <span className="text-base">
                            {book.type === 'owner' ? '👤' : '👥'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate transition-colors ${
                            index === selectedIndex ? 'text-accent' : 'text-text-primary'
                          }`}>
                            {book.name}
                          </div>
                          <div className="text-xs text-text-tertiary mt-0.5">
                            {book.docCount} 个文档
                          </div>
                        </div>
                        <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
                          index === selectedIndex ? 'text-accent' : 'text-text-quaternary'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
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
                    const isSelected = resultIndex === selectedIndex
                    return (
                      <div
                        key={`${result.docId}-${result.matchType}`}
                        ref={isSelected ? selectedItemRef : null}
                        className={`px-4 py-3 cursor-pointer transition-all border-b border-border-light last:border-b-0 ${
                          isSelected
                            ? 'bg-accent/15 border-l-4 border-l-accent shadow-sm'
                            : 'hover:bg-bg-secondary border-l-4 border-l-transparent'
                        }`}
                        onClick={() => handleSelectResult(resultIndex)}
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${
                            result.matchType === 'title'
                              ? 'bg-accent/10 text-accent'
                              : 'bg-green-500/10 text-green-600'
                          }`}>
                            {result.matchType === 'title' ? '标题' : '内容'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${
                              isSelected ? 'text-accent' : 'text-text-primary'
                            }`}>
                              {result.title}
                            </div>
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-accent flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </div>
                        {/* Breadcrumb path */}
                        <div className="flex items-center gap-1 text-xs text-text-tertiary mb-1">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="truncate">{result.bookName}</span>
                          {result.path && (
                            <>
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="truncate text-text-quaternary">{result.path}</span>
                            </>
                          )}
                        </div>
                        {result.snippet && (
                          <div className="text-xs text-text-tertiary line-clamp-2 leading-relaxed">
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
        <div className="px-5 py-3 border-t border-border flex justify-between items-center bg-bg-secondary/30">
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-1 bg-bg-tertiary rounded text-[10px] border border-border font-mono min-w-[20px] text-center">↑</kbd>
              <kbd className="px-1.5 py-1 bg-bg-tertiary rounded text-[10px] border border-border font-mono min-w-[20px] text-center">↓</kbd>
              <span>导航</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-1 bg-bg-tertiary rounded text-[10px] border border-border font-mono">Enter</kbd>
              <span>打开</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-1 bg-bg-tertiary rounded text-[10px] border border-border font-mono">ESC</kbd>
              <span>关闭</span>
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-text-tertiary hover:text-text-primary transition-colors font-medium"
          >
            重置筛选
          </button>
        </div>
      </div>
    </div>
  )
}
