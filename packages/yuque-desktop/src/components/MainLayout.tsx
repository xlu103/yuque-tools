import { useEffect, useCallback, useState, useRef } from 'react'
import { useBooks, useSync, useSyncEvents, useToast, useIsElectron, useSettings, useSearch } from '../hooks'
import type { Session, SyncProgress, SearchResult } from '../hooks'
import { useBooksStore, useSyncStore, usePanelLayoutStore, useReadingHistoryStore } from '../stores'
import { MacSidebar, SidebarSection, SidebarItem } from './ui/MacSidebar'
import { MacToolbar, ToolbarGroup, ToolbarDivider, ToolbarTitle } from './ui/MacToolbar'
import { MacButton } from './ui/MacButton'
import { MacProgress } from './ui/MacProgress'
import { PanelResizer } from './ui/PanelResizer'
import { BookList } from './BookList'
import { DocumentTree } from './DocumentTree'
import { SettingsPanel } from './SettingsPanel'
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
  const { listBooks, getBookDocs, getLocalDocs, getAllNotesForSync } = useBooks()
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
    documentListWidth,
    setSidebarWidth,
    setDocumentListWidth,
    loadLayout,
    saveLayout
  } = usePanelLayoutStore()

  // Reading history
  const { history: readingHistory, addToHistory, loadHistory } = useReadingHistoryStore()

  const [showSettings, setShowSettings] = useState(false)
  const [hideFailedDocs, setHideFailedDocs] = useState(false)
  const [previewFontSize, setPreviewFontSize] = useState(16)
  const [syncReminder, setSyncReminder] = useState<string | null>(null)
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  
  // Preview state
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; title: string } | null>(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Network loading state (for background fetch indicator)
  const [isFetchingRemote, setIsFetchingRemote] = useState(false)
  
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

  // Global keyboard shortcuts (Cmd/Ctrl + K for search, Escape to close preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      
      // Cmd/Ctrl + K: Focus search
      if (isMod && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // Escape: Close preview or search results
      if (e.key === 'Escape') {
        if (showSearchResults) {
          setShowSearchResults(false)
        } else if (previewDoc) {
          setPreviewDoc(null)
        }
      }
      // Cmd/Ctrl + W: Close preview
      if (isMod && e.key === 'w' && previewDoc) {
        e.preventDefault()
        setPreviewDoc(null)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearchResults, previewDoc])

  // Load books and settings on mount
  useEffect(() => {
    loadBooks()
    loadLayout() // Load saved panel layout
    loadHistory() // Load reading history
    
    // Load hideFailedDocs setting
    getSettings().then(settings => {
      setHideFailedDocs(settings.hideFailedDocs || false)
      setPreviewFontSize(settings.previewFontSize || 16)
    }).catch(console.error)
    
    // Check last sync time for reminder (7 days threshold)
    if (window.electronAPI) {
      window.electronAPI['stats:get']().then(stats => {
        if (stats.lastSyncTime) {
          const lastSync = new Date(stats.lastSyncTime)
          const daysSince = Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24))
          if (daysSince >= 7) {
            setSyncReminder(`已有 ${daysSince} 天未同步`)
          }
        } else if (stats.totalDocuments > 0) {
          setSyncReminder('尚未进行过同步')
        }
      }).catch(console.error)
    }
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
      // Settings panel closed, check if settings changed
      const checkAutoSyncSettings = async () => {
        try {
          const settings = await getSettings()
          const newInterval = settings.autoSyncInterval || 0
          
          // Also update hideFailedDocs setting
          setHideFailedDocs(settings.hideFailedDocs || false)
          setPreviewFontSize(settings.previewFontSize || 16)
          
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
      
      // Auto sync files to local if enabled - read directly from settings to ensure latest value
      const settings = await getSettings()
      
      if (settings.autoSyncOnOpen && bookId !== NOTES_BOOK_ID && settings.syncDirectory) {
        // Check if there are documents that need syncing (new or modified)
        // Filter out TITLE (folder) type documents
        const docsNeedSync = docs.filter(d => 
          (d.syncStatus === 'new' || d.syncStatus === 'modified') && d.docType !== 'TITLE'
        )
        
        if (docsNeedSync.length > 0) {
          showToast('info', `正在自动同步 ${docsNeedSync.length} 个文档...`)
          try {
            setRunning(true)
            await startSync({ bookIds: [bookId], force: false })
          } catch (syncError) {
            console.error('Auto sync failed:', syncError)
            showToast('error', '自动同步失败')
            setRunning(false)
          }
        }
      }
    } catch (error: any) {
      if (isSessionExpiredError(error)) {
        showToast('error', '登录已过期，请重新登录')
        onLogout()
      } else {
        // Only show error if we don't have local data
        const docs = getDocumentsForBook(bookId)
        if (docs.length === 0) {
          showToast('error', '获取文档列表失败')
        } else {
          showToast('warning', '网络获取失败，显示本地缓存')
        }
      }
      console.error('Failed to load documents:', error)
    } finally {
      setIsFetchingRemote(false)
    }
  }, [getLocalDocs, getBookDocs, setDocuments, showToast, onLogout, isRunning, getSettings, startSync, setRunning, getDocumentsForBook])

  // Handle sync events
  useSyncEvents({
    onProgress: (p: SyncProgress) => {
      setProgress(p)
    },
    onComplete: (result) => {
      setRunning(false)
      setProgress(null)
      setSyncReminder(null) // Clear reminder after sync
      if (result.success) {
        // Show detailed sync report
        const parts = []
        if (result.syncedDocs > 0) parts.push(`${result.syncedDocs} 个文档已同步`)
        if (result.failedDocs > 0) parts.push(`${result.failedDocs} 个失败`)
        showToast('success', parts.length > 0 ? parts.join('，') : '同步完成，无更新')
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

  // Close search results and sync menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.search-container')) {
        setShowSearchResults(false)
      }
      if (!target.closest('.sync-menu-container')) {
        setShowSyncMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Get current documents
  const currentDocs = selectedBookId ? getDocumentsForBook(selectedBookId) : []
  const selectedBook = books.find(b => b.id === selectedBookId)

  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} onLogout={onLogout} />
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
            <div className="flex items-center gap-1">
              <button
                onClick={loadBooks}
                className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                title="刷新知识库"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                title="设置"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          }
        >
          {/* Reading History */}
          {readingHistory.length > 0 && (
            <SidebarSection title="最近阅读">
              {readingHistory.slice(0, 5).map((item, i) => (
                <SidebarItem
                  key={i}
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  label={item.title}
                  onClick={() => setPreviewDoc({ filePath: item.filePath, title: item.title })}
                />
              ))}
            </SidebarSection>
          )}
          
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

          <div className="flex-1" />

          {/* Network loading indicator */}
          {isFetchingRemote && (
            <div className="flex items-center gap-2 text-text-secondary mr-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">获取中...</span>
            </div>
          )}

          {/* Sync controls - dropdown menu */}
          <ToolbarGroup>
            {isRunning ? (
              <MacButton variant="secondary" size="sm" onClick={handleCancelSync}>
                取消同步
              </MacButton>
            ) : (
              <div className="relative sync-menu-container">
                {syncReminder && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full z-10" />
                )}
                <MacButton 
                  variant="primary" 
                  size="sm" 
                  onClick={() => setShowSyncMenu(!showSyncMenu)}
                  disabled={!selectedBookId && books.length === 0}
                  title={syncReminder || '同步'}
                  className="pr-1"
                >
                  同步
                  <svg className={`w-3 h-3 ml-1 transition-transform ${showSyncMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </MacButton>
                {/* Dropdown menu */}
                {showSyncMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-bg-primary border border-border rounded-lg shadow-lg z-50 animate-fade-in">
                    <div className="py-1">
                      <button
                        onClick={() => { handleSync(false); setSyncReminder(null); setShowSyncMenu(false) }}
                        disabled={!selectedBookId}
                        className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        同步当前知识库
                      </button>
                      <button
                        onClick={() => { handleGlobalSync(false); setSyncReminder(null); setShowSyncMenu(false) }}
                        disabled={books.length === 0}
                        className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        同步所有知识库
                      </button>
                      <div className="border-t border-border-light my-1" />
                      <button
                        onClick={() => { handleSync(true); setShowSyncMenu(false) }}
                        disabled={!selectedBookId}
                        className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        强制同步 (覆盖本地)
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
          {/* Document list with fixed width */}
          <div 
            style={{ width: documentListWidth }} 
            className="flex-shrink-0 overflow-auto border-r border-border-light transition-all duration-200"
          >
            <DocumentTree
              documents={currentDocs}
              loading={isLoadingDocs}
              emptyMessage={selectedBookId ? '暂无文档' : '请选择知识库'}
              bookInfo={selectedBook ? { userLogin: selectedBook.userLogin, slug: selectedBook.slug } : undefined}
              bookId={selectedBookId || undefined}
              hideFailedDocs={hideFailedDocs}
              onPreview={(doc) => {
                if (doc.localPath) {
                  setPreviewDoc({ filePath: doc.localPath, title: doc.title })
                  addToHistory({ filePath: doc.localPath, title: doc.title, bookId: selectedBookId || undefined, bookName: selectedBook?.name })
                }
              }}
              onDocumentSynced={(doc) => {
                // Update document in store after single doc sync
                if (selectedBookId) {
                  const docs = getDocumentsForBook(selectedBookId)
                  const updatedDocs = docs.map(d => 
                    d.id === doc.id ? { ...d, ...doc } : d
                  )
                  setDocuments(selectedBookId, updatedDocs)
                }
              }}
            />
          </div>

          {/* Document List Resizer */}
          <PanelResizer
            direction="horizontal"
            onResize={(delta) => setDocumentListWidth(documentListWidth + delta)}
            onResizeEnd={saveLayout}
          />

          {/* Preview area - fills remaining space */}
          {previewDoc ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
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
                fontSize={previewFontSize}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-bg-secondary">
              <div className="max-w-md text-center px-6">
                {/* Icon */}
                <svg className="w-20 h-20 mx-auto mb-6 text-text-quaternary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                
                {/* Main message */}
                <h3 className="text-lg font-medium text-text-primary mb-2">选择文档开始预览</h3>
                <p className="text-sm text-text-secondary mb-6">从左侧文档列表中选择一个文档，或使用快捷键快速操作</p>
                
                {/* Quick actions */}
                <div className="space-y-3 text-left bg-bg-primary rounded-lg p-4 border border-border-light">
                  <div className="flex items-center gap-3 text-sm">
                    <kbd className="px-2 py-1 bg-bg-tertiary rounded text-xs font-mono border border-border">⌘K</kbd>
                    <span className="text-text-secondary">搜索文档</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <kbd className="px-2 py-1 bg-bg-tertiary rounded text-xs font-mono border border-border">⌘W</kbd>
                    <span className="text-text-secondary">关闭预览</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <kbd className="px-2 py-1 bg-bg-tertiary rounded text-xs font-mono border border-border">ESC</kbd>
                    <span className="text-text-secondary">退出搜索/预览</span>
                  </div>
                </div>
                
                {/* Recent reading */}
                {readingHistory.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-medium text-text-tertiary mb-3 text-left">最近阅读</h4>
                    <div className="space-y-2">
                      {readingHistory.slice(0, 3).map((item, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewDoc({ filePath: item.filePath, title: item.title })}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left bg-bg-primary hover:bg-bg-tertiary rounded-lg border border-border-light transition-colors group"
                        >
                          <svg className="w-4 h-4 text-text-tertiary group-hover:text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm text-text-primary truncate flex-1">{item.title}</span>
                          <svg className="w-4 h-4 text-text-quaternary group-hover:text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
