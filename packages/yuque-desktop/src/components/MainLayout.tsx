import { useEffect, useCallback, useState, useRef } from 'react'
import { useBooks, useSync, useSyncEvents, useToast, useIsElectron, useSettings, useSearch } from '../hooks'
import type { Session, SyncProgress, SearchResult } from '../hooks'
import { useBooksStore, useSyncStore, usePanelLayoutStore } from '../stores'
import { MacSidebar, SidebarSection, SidebarItem } from './ui/MacSidebar'
import { MacToolbar, ToolbarGroup, ToolbarDivider, ToolbarTitle } from './ui/MacToolbar'
import { MacButton } from './ui/MacButton'
import { MacProgress } from './ui/MacProgress'
import { PanelResizer } from './ui/PanelResizer'
import { BookList } from './BookList'
import { DocumentList } from './DocumentList'
import { DocumentTree } from './DocumentTree'
import { SettingsPanel } from './SettingsPanel'
import { SyncHistoryPanel } from './SyncHistoryPanel'
import { StatisticsPanel } from './StatisticsPanel'
import { MarkdownPreview } from './MarkdownPreview'

// Notes book ID constant
const NOTES_BOOK_ID = '__notes__'

// Helper function to check if error is session expired
function isSessionExpiredError(error: any): boolean {
  const message = error?.message || String(error)
  return message.includes('未登录') || message.includes('会话已过期') || message.includes('session expired')
}

interface MainLayoutProps {
  session: Session
  onLogout: () => void
}

export function MainLayout({ session, onLogout }: MainLayoutProps) {
  const isElectron = useIsElectron()
  const { listBooks, getBookDocs, getLocalDocs, loadMoreNotes, getAllNotesForSync } = useBooks()
  const { startSync, cancelSync } = useSync()
  const { getSettings } = useSettings()
  const { showToast } = useToast()
  const { search } = useSearch()
  
  const { 
    books, 
    selectedBookId, 
    setBooks, 
    setSelectedBookId, 
    setDocuments,
    setLoadingBooks,
    setLoadingDocs,
    isLoadingBooks,
    isLoadingDocs,
    getDocumentsForBook
  } = useBooksStore()
  
  const {
    isRunning,
    progress,
    setRunning,
    setProgress
  } = useSyncStore()

  // Panel layout state
  const {
    sidebarWidth,
    previewWidth,
    setSidebarWidth,
    setPreviewWidth,
    loadLayout,
    saveLayout
  } = usePanelLayoutStore()

  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree') // Default to tree view
  
  // Preview state
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; title: string } | null>(null)
  const [hasExpandedForPreview, setHasExpandedForPreview] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Notes lazy loading state
  const [notesHasMore, setNotesHasMore] = useState(true)
  const [notesLoading, setNotesLoading] = useState(false)
  
  // Network loading state (for background fetch indicator)
  const [isFetchingRemote, setIsFetchingRemote] = useState(false)
  
  // Settings cache
  const [autoSyncOnOpen, setAutoSyncOnOpen] = useState(false)
  
  // Auto sync timer ref
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSyncIntervalRef = useRef<number>(0)

  // Keyboard shortcut handlers
  useEffect(() => {
    if (!isElectron) return

    const doSync = () => {
      if (!isRunning && selectedBookId) {
        handleSync(false)
      }
    }

    const unsubSync = window.electronAPI.on('shortcut:sync' as any, doSync)
    const unsubRefresh = window.electronAPI.on('shortcut:refresh' as any, loadBooks)
    const unsubSettings = window.electronAPI.on('shortcut:settings' as any, () => setShowSettings(true))

    return () => {
      unsubSync()
      unsubRefresh()
      unsubSettings()
    }
  }, [isElectron, isRunning, selectedBookId])

  // Load books and settings on mount
  useEffect(() => {
    loadBooks()
    loadLayout() // Load saved panel layout
    
    // Load autoSyncOnOpen setting
    getSettings().then(settings => {
      setAutoSyncOnOpen(settings.autoSyncOnOpen || false)
    }).catch(console.error)
  }, [])

  // Auto sync setup
  useEffect(() => {
    const setupAutoSync = async () => {
      try {
        const settings = await getSettings()
        const interval = settings.autoSyncInterval || 0
        
        // Clear existing timer
        if (autoSyncTimerRef.current) {
          clearInterval(autoSyncTimerRef.current)
          autoSyncTimerRef.current = null
        }
        
        autoSyncIntervalRef.current = interval
        
        if (interval > 0) {
          // Set up new timer (interval is in minutes, convert to ms)
          autoSyncTimerRef.current = setInterval(() => {
            // Only auto sync if not already syncing
            if (!isRunning && books.length > 0) {
              console.log('Auto sync triggered')
              const allBookIds = books.map(b => b.id)
              startSync({ bookIds: allBookIds, force: false })
                .then(() => setRunning(true))
                .catch(console.error)
            }
          }, interval * 60 * 1000)
          
          console.log(`Auto sync enabled: every ${interval} minutes`)
        }
      } catch (error) {
        console.error('Failed to setup auto sync:', error)
      }
    }
    
    setupAutoSync()
    
    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current)
      }
    }
  }, [getSettings, books, isRunning, startSync, setRunning])

  // Reload auto sync settings when returning from settings panel
  useEffect(() => {
    if (!showSettings) {
      // Settings panel closed, check if auto sync interval changed
      const checkAutoSyncSettings = async () => {
        try {
          const settings = await getSettings()
          const newInterval = settings.autoSyncInterval || 0
          
          if (newInterval !== autoSyncIntervalRef.current) {
            // Interval changed, clear and reset timer
            if (autoSyncTimerRef.current) {
              clearInterval(autoSyncTimerRef.current)
              autoSyncTimerRef.current = null
            }
            
            autoSyncIntervalRef.current = newInterval
            
            if (newInterval > 0 && books.length > 0) {
              autoSyncTimerRef.current = setInterval(() => {
                if (!isRunning) {
                  console.log('Auto sync triggered')
                  const allBookIds = books.map(b => b.id)
                  startSync({ bookIds: allBookIds, force: false })
                    .then(() => setRunning(true))
                    .catch(console.error)
                }
              }, newInterval * 60 * 1000)
              
              console.log(`Auto sync updated: every ${newInterval} minutes`)
            }
          }
        } catch (error) {
          console.error('Failed to check auto sync settings:', error)
        }
      }
      
      checkAutoSyncSettings()
    }
  }, [showSettings, getSettings, books, isRunning, startSync, setRunning])

  const loadBooks = useCallback(async () => {
    setLoadingBooks(true)
    try {
      const bookList = await listBooks()
      setBooks(bookList)
      
      // Auto-select first book if none selected
      if (bookList.length > 0 && !selectedBookId) {
        setSelectedBookId(bookList[0].id)
      }
    } catch (error: any) {
      if (isSessionExpiredError(error)) {
        showToast('error', '登录已过期，请重新登录')
        onLogout()
      } else {
        showToast('error', '获取知识库失败')
      }
      console.error('Failed to load books:', error)
    } finally {
      setLoadingBooks(false)
    }
  }, [listBooks, setBooks, setLoadingBooks, selectedBookId, setSelectedBookId, showToast, onLogout])

  // Load documents when book is selected
  useEffect(() => {
    if (selectedBookId) {
      loadDocuments(selectedBookId)
    }
  }, [selectedBookId])

  const loadDocuments = useCallback(async (bookId: string) => {
    // Step 1: First load local cached documents (instant)
    try {
      const localDocs = await getLocalDocs(bookId)
      if (localDocs.length > 0) {
        setDocuments(bookId, localDocs)
        console.log(`[loadDocuments] Loaded ${localDocs.length} local cached documents`)
      }
    } catch (error) {
      console.error('Failed to load local docs:', error)
    }
    
    // Step 2: Fetch from network in background
    setIsFetchingRemote(true)
    try {
      const docs = await getBookDocs(bookId)
      setDocuments(bookId, docs)
      console.log(`[loadDocuments] Fetched ${docs.length} documents from network`)
      
      // Reset notes lazy loading state when switching to notes book
      if (bookId === NOTES_BOOK_ID) {
        setNotesHasMore(true)
      }
      
      // Auto sync if enabled
      if (autoSyncOnOpen && !isRunning && bookId !== NOTES_BOOK_ID) {
        const settings = await getSettings()
        if (settings.syncDirectory) {
          console.log('[loadDocuments] Auto sync on open enabled, starting sync...')
          try {
            await startSync({ bookIds: [bookId], force: false })
            setRunning(true)
          } catch (syncError) {
            console.error('Auto sync failed:', syncError)
          }
        }
      }
    } catch (error: any) {
      if (isSessionExpiredError(error)) {
        showToast('error', '登录已过期，请重新登录')
        onLogout()
      } else {
        // Only show error if we don't have local data
        const currentDocs = getDocumentsForBook(bookId)
        if (currentDocs.length === 0) {
          showToast('error', '获取文档列表失败')
        } else {
          showToast('warning', '网络获取失败，显示本地缓存')
        }
      }
      console.error('Failed to load documents:', error)
    } finally {
      setIsFetchingRemote(false)
    }
  }, [getLocalDocs, getBookDocs, setDocuments, showToast, onLogout, autoSyncOnOpen, isRunning, getSettings, startSync, setRunning, getDocumentsForBook])

  // Load more notes (lazy loading)
  const handleLoadMoreNotes = useCallback(async () => {
    if (selectedBookId !== NOTES_BOOK_ID || notesLoading || !notesHasMore) {
      return
    }
    
    const currentDocs = getDocumentsForBook(NOTES_BOOK_ID)
    const offset = currentDocs.length
    
    setNotesLoading(true)
    try {
      const result = await loadMoreNotes(offset, 20)
      
      // Append new notes to existing ones
      const newDocs = [...currentDocs, ...result.notes]
      setDocuments(NOTES_BOOK_ID, newDocs)
      setNotesHasMore(result.hasMore)
      
      console.log(`Loaded ${result.notes.length} more notes, hasMore: ${result.hasMore}`)
    } catch (error) {
      console.error('Failed to load more notes:', error)
      showToast('error', '加载更多小记失败')
    } finally {
      setNotesLoading(false)
    }
  }, [selectedBookId, notesLoading, notesHasMore, getDocumentsForBook, loadMoreNotes, setDocuments, showToast])

  // Handle sync events
  useSyncEvents({
    onProgress: (p: SyncProgress) => {
      setProgress(p)
    },
    onComplete: (result) => {
      setRunning(false)
      setProgress(null)
      if (result.success) {
        showToast('success', `同步完成: ${result.syncedDocs} 个文档`)
        // Refresh current book documents
        if (selectedBookId) {
          loadDocuments(selectedBookId)
        }
      } else {
        showToast('error', `同步失败: ${result.failedDocs} 个文档出错`)
      }
    },
    onError: (error) => {
      setRunning(false)
      setProgress(null)
      if (isSessionExpiredError(error)) {
        showToast('error', '登录已过期，请重新登录')
        onLogout()
      } else {
        showToast('error', error.message)
      }
    }
  })

  // Handle sync
  const handleSync = useCallback(async (force = false) => {
    if (!selectedBookId) {
      showToast('warning', '请先选择知识库')
      return
    }

    setRunning(true)
    try {
      // For notes book, fetch all notes first before syncing
      if (selectedBookId === NOTES_BOOK_ID) {
        showToast('info', '正在获取所有小记...')
        await getAllNotesForSync()
      }
      
      await startSync({ bookIds: [selectedBookId], force })
    } catch (error: any) {
      setRunning(false)
      if (isSessionExpiredError(error)) {
        showToast('error', '登录已过期，请重新登录')
        onLogout()
      } else {
        showToast('error', '启动同步失败')
      }
    }
  }, [selectedBookId, startSync, setRunning, showToast, getAllNotesForSync, onLogout])

  // Handle global sync (sync all books)
  const handleGlobalSync = useCallback(async (force = false) => {
    if (books.length === 0) {
      showToast('warning', '没有可同步的知识库')
      return
    }

    setRunning(true)
    try {
      // Check if notes book is included, fetch all notes first
      const hasNotesBook = books.some(b => b.id === NOTES_BOOK_ID)
      if (hasNotesBook) {
        showToast('info', '正在获取所有小记...')
        await getAllNotesForSync()
      }
      
      const allBookIds = books.map(b => b.id)
      await startSync({ bookIds: allBookIds, force })
    } catch (error: any) {
      setRunning(false)
      if (isSessionExpiredError(error)) {
        showToast('error', '登录已过期，请重新登录')
        onLogout()
      } else {
        showToast('error', '启动全局同步失败')
      }
    }
  }, [books, startSync, setRunning, showToast, getAllNotesForSync, onLogout])

  // Handle cancel sync
  const handleCancelSync = useCallback(async () => {
    try {
      await cancelSync()
      setRunning(false)
      setProgress(null)
      showToast('info', '同步已取消')
    } catch (error) {
      console.error('Failed to cancel sync:', error)
    }
  }, [cancelSync, setRunning, setProgress, showToast])

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    setShowSearchResults(true)
    try {
      const results = await search(searchQuery.trim(), { limit: 20, searchContent: true })
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, search])

  // Handle search result click
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    if (result.localPath && window.electronAPI) {
      window.electronAPI['file:open'](result.localPath)
    } else {
      setSelectedBookId(result.bookId)
    }
    setShowSearchResults(false)
    setSearchQuery('')
  }, [setSelectedBookId])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.search-container')) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Get current documents
  const currentDocs = selectedBookId ? getDocumentsForBook(selectedBookId) : []
  const selectedBook = books.find(b => b.id === selectedBookId)

  // Filter documents by status
  const filteredDocs = statusFilter 
    ? currentDocs.filter(d => d.syncStatus === statusFilter)
    : currentDocs

  // Count documents by status
  const statusCounts = currentDocs.reduce((acc, doc) => {
    acc[doc.syncStatus] = (acc[doc.syncStatus] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (showStats) {
    return <StatisticsPanel onClose={() => setShowStats(false)} />
  }

  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} onLogout={onLogout} />
  }

  if (showHistory) {
    return <SyncHistoryPanel onClose={() => setShowHistory(false)} />
  }

  return (
    <div className="h-screen w-screen flex bg-bg-primary">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="flex-shrink-0">
        <MacSidebar
          topContent={
            <div className="px-2 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
                {session.userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{session.userName}</p>
                <p className="text-xs text-text-secondary truncate">@{session.login}</p>
              </div>
            </div>
          }
          bottomContent={
            <div className="space-y-1">
              <SidebarItem
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                label="统计"
                onClick={() => setShowStats(true)}
              />
              <SidebarItem
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                label="同步历史"
                onClick={() => setShowHistory(true)}
              />
              <SidebarItem
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
                label="刷新"
                onClick={loadBooks}
              />
              <SidebarItem
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                label="设置"
                onClick={() => setShowSettings(true)}
              />
            </div>
          }
        >
          {/* Book list */}
          <SidebarSection title="知识库">
            <BookList
              books={books}
              selectedId={selectedBookId}
              onSelect={setSelectedBookId}
              loading={isLoadingBooks}
            />
          </SidebarSection>
        </MacSidebar>
      </div>

      {/* Sidebar Resizer */}
      <PanelResizer
        direction="horizontal"
        onResize={(delta) => setSidebarWidth(sidebarWidth + delta)}
        onResizeEnd={saveLayout}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar - spans full width of main area */}
        <MacToolbar>
          {/* Search box */}
          <div className="search-container relative">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                  if (e.key === 'Escape') {
                    setShowSearchResults(false)
                    setSearchQuery('')
                  }
                }}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                placeholder="搜索文档..."
                className="w-48 pl-8 pr-3 py-1 text-xs bg-bg-secondary border border-border rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent focus:w-64 transition-all"
              />
            </div>
            
            {/* Search results dropdown */}
            {showSearchResults && (
              <div className="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-auto bg-bg-primary border border-border rounded-lg shadow-lg z-50">
                {isSearching ? (
                  <div className="p-4 text-center text-text-secondary text-sm">搜索中...</div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y divide-border-light">
                    {searchResults.map((result) => (
                      <div
                        key={`${result.docId}-${result.matchType}`}
                        className="px-3 py-2 hover:bg-bg-secondary cursor-pointer"
                        onClick={() => handleSearchResultClick(result)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-1 py-0.5 text-xs rounded ${
                            result.matchType === 'title' 
                              ? 'bg-accent/10 text-accent' 
                              : 'bg-green-500/10 text-green-600'
                          }`}>
                            {result.matchType === 'title' ? '标题' : '内容'}
                          </span>
                          <span className="text-sm text-text-primary truncate flex-1">{result.title}</span>
                        </div>
                        <p className="text-xs text-text-tertiary mt-0.5 truncate">{result.bookName}</p>
                        {result.snippet && (
                          <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{result.snippet}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="p-4 text-center text-text-secondary text-sm">未找到结果</div>
                ) : null}
              </div>
            )}
          </div>
          
          <ToolbarDivider />
          
          <ToolbarGroup>
            <ToolbarTitle>
              {selectedBook?.name || '选择知识库'}
            </ToolbarTitle>
            {selectedBook && (
              <span className="ml-2 text-xs text-text-secondary">
                {currentDocs.length} 个文档
              </span>
            )}
          </ToolbarGroup>
          
          <ToolbarDivider />
          
          {/* Status filter */}
          <ToolbarGroup>
            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="text-xs bg-bg-secondary border border-border rounded px-2 py-1 text-text-primary"
            >
              <option value="">全部状态</option>
              <option value="new">新增 ({statusCounts.new || 0})</option>
              <option value="modified">已修改 ({statusCounts.modified || 0})</option>
              <option value="synced">已同步 ({statusCounts.synced || 0})</option>
              <option value="deleted">已删除 ({statusCounts.deleted || 0})</option>
              <option value="failed">同步失败 ({statusCounts.failed || 0})</option>
            </select>
          </ToolbarGroup>
          
          <ToolbarDivider />
          
          {/* View mode toggle */}
          <ToolbarGroup>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list' 
                  ? 'bg-accent/10 text-accent' 
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'
              }`}
              title="列表视图"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'tree' 
                  ? 'bg-accent/10 text-accent' 
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-secondary'
              }`}
              title="树形视图"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          </ToolbarGroup>

          <div className="flex-1" />

          {/* Network loading indicator */}
          {isFetchingRemote && (
            <div className="flex items-center gap-2 text-text-secondary mr-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">获取中...</span>
            </div>
          )}

          {/* Sync controls */}
          <ToolbarGroup>
            {isRunning ? (
              <MacButton variant="secondary" size="sm" onClick={handleCancelSync}>
                取消
              </MacButton>
            ) : (
              <>
                <MacButton 
                  variant="primary" 
                  size="sm" 
                  onClick={() => handleSync(false)}
                  disabled={!selectedBookId}
                  title="同步当前知识库"
                >
                  同步
                </MacButton>
                <MacButton 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => handleGlobalSync(false)}
                  disabled={books.length === 0}
                  title="同步所有知识库"
                >
                  全局同步
                </MacButton>
                <MacButton 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSync(true)}
                  disabled={!selectedBookId}
                  title="强制重新下载当前知识库所有文档"
                >
                  强制同步
                </MacButton>
              </>
            )}
          </ToolbarGroup>
        </MacToolbar>

        {/* Sync progress */}
        {isRunning && progress && (
          <div className="px-4 py-2 bg-bg-secondary border-b border-border-light">
            <div className="flex items-center gap-3">
              <MacProgress 
                value={progress.current} 
                max={progress.total} 
                size="sm"
                className="flex-1"
              />
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {progress.current}/{progress.total} - {progress.currentDoc}
              </span>
            </div>
          </div>
        )}

        {/* Document list and Preview panel in same horizontal container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document list */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'tree' ? (
              <DocumentTree
                documents={filteredDocs}
                loading={isLoadingDocs}
                emptyMessage={selectedBookId ? '暂无文档' : '请选择知识库'}
                bookInfo={selectedBook ? { userLogin: selectedBook.userLogin, slug: selectedBook.slug } : undefined}
                bookId={selectedBookId || undefined}
                onPreview={(doc) => {
                  if (doc.localPath) {
                    if (!previewDoc && !hasExpandedForPreview && window.electronAPI) {
                      window.electronAPI['window:expandWidth'](500)
                      setHasExpandedForPreview(true)
                    }
                    setPreviewDoc({ filePath: doc.localPath, title: doc.title })
                  }
                }}
              />
            ) : (
              <DocumentList
                documents={filteredDocs}
                loading={isLoadingDocs}
                emptyMessage={selectedBookId ? '暂无文档' : '请选择知识库'}
                onLoadMore={selectedBookId === NOTES_BOOK_ID ? handleLoadMoreNotes : undefined}
                hasMore={selectedBookId === NOTES_BOOK_ID ? notesHasMore : false}
                loadingMore={notesLoading}
                bookInfo={selectedBook ? { userLogin: selectedBook.userLogin, slug: selectedBook.slug } : undefined}
                onPreview={(doc) => {
                  if (doc.localPath) {
                    if (!previewDoc && !hasExpandedForPreview && window.electronAPI) {
                      window.electronAPI['window:expandWidth'](500)
                      setHasExpandedForPreview(true)
                    }
                    setPreviewDoc({ filePath: doc.localPath, title: doc.title })
                  }
                }}
              />
            )}
          </div>

          {/* Preview Panel Resizer */}
          {previewDoc && (
            <PanelResizer
              direction="horizontal"
              onResize={(delta) => setPreviewWidth(previewWidth - delta)}
              onResizeEnd={saveLayout}
            />
          )}

          {/* Right Preview Panel */}
          {previewDoc && (
            <div style={{ width: previewWidth }} className="flex-shrink-0 border-l border-border flex flex-col bg-bg-primary">
              <MarkdownPreview
                filePath={previewDoc.filePath}
                title={previewDoc.title}
                onClose={() => setPreviewDoc(null)}
                onOpenExternal={() => {
                  if (window.electronAPI) {
                    window.electronAPI['file:open'](previewDoc.filePath)
                  }
                }}
                onShowInFolder={() => {
                  if (window.electronAPI) {
                    window.electronAPI['file:showInFolder'](previewDoc.filePath)
                  }
                }}
                isPanel
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
