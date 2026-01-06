import { useEffect, useCallback, useState, useRef } from 'react'
import { useBooks, useSync, useSyncEvents, useToast, useIsElectron, useSettings } from '../hooks'
import type { Session, SyncProgress } from '../hooks'
import { useBooksStore, useSyncStore } from '../stores'
import { MacSidebar, SidebarSection, SidebarItem } from './ui/MacSidebar'
import { MacToolbar, ToolbarGroup, ToolbarDivider, ToolbarTitle } from './ui/MacToolbar'
import { MacButton } from './ui/MacButton'
import { MacProgress } from './ui/MacProgress'
import { BookList } from './BookList'
import { DocumentList } from './DocumentList'
import { SettingsPanel } from './SettingsPanel'
import { SyncHistoryPanel } from './SyncHistoryPanel'

interface MainLayoutProps {
  session: Session
  onLogout: () => void
}

export function MainLayout({ session, onLogout }: MainLayoutProps) {
  const isElectron = useIsElectron()
  const { listBooks, getBookDocs } = useBooks()
  const { startSync, cancelSync } = useSync()
  const { getSettings } = useSettings()
  const { showToast } = useToast()
  
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

  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  
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

  // Load books on mount
  useEffect(() => {
    loadBooks()
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
    } catch (error) {
      showToast('error', '获取知识库失败')
      console.error('Failed to load books:', error)
    } finally {
      setLoadingBooks(false)
    }
  }, [listBooks, setBooks, setLoadingBooks, selectedBookId, setSelectedBookId, showToast])

  // Load documents when book is selected
  useEffect(() => {
    if (selectedBookId) {
      loadDocuments(selectedBookId)
    }
  }, [selectedBookId])

  const loadDocuments = useCallback(async (bookId: string) => {
    setLoadingDocs(true)
    try {
      const docs = await getBookDocs(bookId)
      setDocuments(bookId, docs)
    } catch (error) {
      showToast('error', '获取文档列表失败')
      console.error('Failed to load documents:', error)
    } finally {
      setLoadingDocs(false)
    }
  }, [getBookDocs, setDocuments, setLoadingDocs, showToast])

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
      showToast('error', error.message)
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
      await startSync({ bookIds: [selectedBookId], force })
    } catch (error) {
      setRunning(false)
      showToast('error', '启动同步失败')
    }
  }, [selectedBookId, startSync, setRunning, showToast])

  // Handle global sync (sync all books)
  const handleGlobalSync = useCallback(async (force = false) => {
    if (books.length === 0) {
      showToast('warning', '没有可同步的知识库')
      return
    }

    setRunning(true)
    try {
      const allBookIds = books.map(b => b.id)
      await startSync({ bookIds: allBookIds, force })
    } catch (error) {
      setRunning(false)
      showToast('error', '启动全局同步失败')
    }
  }, [books, startSync, setRunning, showToast])

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

  if (showSettings) {
    return <SettingsPanel onClose={() => setShowSettings(false)} onLogout={onLogout} />
  }

  if (showHistory) {
    return <SyncHistoryPanel onClose={() => setShowHistory(false)} />
  }

  return (
    <div className="h-screen w-screen flex bg-bg-primary">
      {/* Sidebar */}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <MacToolbar>
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

          <div className="flex-1" />

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

        {/* Document list */}
        <div className="flex-1 overflow-auto">
          <DocumentList
            documents={filteredDocs}
            loading={isLoadingDocs}
            emptyMessage={selectedBookId ? '暂无文档' : '请选择知识库'}
          />
        </div>
      </div>
    </div>
  )
}
