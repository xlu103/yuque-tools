import { useCallback, useRef, useEffect } from 'react'
import type { Document } from '../hooks'
import { useIsElectron } from '../hooks'

interface DocumentListProps {
  documents: Document[]
  loading?: boolean
  emptyMessage?: string
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  selectable?: boolean
  // Lazy loading props
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  // Book info for opening in Yuque
  bookInfo?: { userLogin: string; slug: string }
  // Preview callback
  onPreview?: (doc: Document) => void
}

const statusConfig = {
  synced: { label: '已同步', color: 'text-success', bg: 'bg-success/10' },
  pending: { label: '待同步', color: 'text-warning', bg: 'bg-warning/10' },
  modified: { label: '已修改', color: 'text-info', bg: 'bg-info/10' },
  new: { label: '新增', color: 'text-accent', bg: 'bg-accent/10' },
  deleted: { label: '已删除', color: 'text-error', bg: 'bg-error/10' },
  failed: { label: '同步失败', color: 'text-error', bg: 'bg-error/10' }
}

export function DocumentList({ 
  documents, 
  loading, 
  emptyMessage = '暂无文档',
  selectedIds = new Set(),
  onSelectionChange,
  selectable = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  bookInfo,
  onPreview
}: DocumentListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const isElectron = useIsElectron()

  // File operations
  const handleOpenFile = useCallback(async (doc: Document) => {
    if (!isElectron || !doc.localPath) return
    try {
      const result = await window.electronAPI['file:open'](doc.localPath)
      if (!result.success) {
        console.error('Failed to open file:', result.error)
      }
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }, [isElectron])

  const handleOpenInYuque = useCallback(async (doc: Document) => {
    if (!isElectron || !bookInfo) return
    try {
      const result = await window.electronAPI['file:openInYuque']({
        userLogin: bookInfo.userLogin,
        bookSlug: bookInfo.slug,
        docSlug: doc.slug
      })
      if (!result.success) {
        console.error('Failed to open in Yuque:', result.error)
      }
    } catch (error) {
      console.error('Failed to open in Yuque:', error)
    }
  }, [isElectron, bookInfo])

  const handleShowInFolder = useCallback(async (doc: Document) => {
    if (!isElectron || !doc.localPath) return
    try {
      const result = await window.electronAPI['file:showInFolder'](doc.localPath)
      if (!result.success) {
        console.error('Failed to show in folder:', result.error)
      }
    } catch (error) {
      console.error('Failed to show in folder:', error)
    }
  }, [isElectron])

  // Scroll handler for lazy loading
  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return
    
    const listElement = listRef.current
    if (!listElement) return
    
    let isLoading = false
    
    const handleScroll = () => {
      if (isLoading) return
      
      const { scrollTop, scrollHeight, clientHeight } = listElement
      // Load more when scrolled to bottom (with 100px threshold)
      if (scrollHeight - scrollTop - clientHeight < 100) {
        isLoading = true
        onLoadMore()
        // Reset after a short delay to prevent rapid re-triggering
        setTimeout(() => { isLoading = false }, 500)
      }
    }
    
    listElement.addEventListener('scroll', handleScroll)
    return () => listElement.removeEventListener('scroll', handleScroll)
  }, [onLoadMore, hasMore, loadingMore])

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return
    
    const allSelected = documents.every(d => selectedIds.has(d.id))
    
    if (allSelected) {
      // Deselect all
      const newSelection = new Set(selectedIds)
      documents.forEach(d => newSelection.delete(d.id))
      onSelectionChange(newSelection)
    } else {
      // Select all
      const newSelection = new Set(selectedIds)
      documents.forEach(d => newSelection.add(d.id))
      onSelectionChange(newSelection)
    }
  }, [documents, selectedIds, onSelectionChange])

  // Handle single selection
  const handleToggleSelect = useCallback((docId: string) => {
    if (!onSelectionChange) return
    
    const newSelection = new Set(selectedIds)
    if (newSelection.has(docId)) {
      newSelection.delete(docId)
    } else {
      newSelection.add(docId)
    }
    onSelectionChange(newSelection)
  }, [selectedIds, onSelectionChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
      </div>
    )
  }

  const allSelected = documents.length > 0 && documents.every(d => selectedIds.has(d.id))
  const someSelected = documents.some(d => selectedIds.has(d.id))

  return (
    <div className="flex flex-col h-full">
      {/* Select all header */}
      {selectable && documents.length > 0 && (
        <div className="px-4 py-2 border-b border-border-light bg-bg-secondary flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected
            }}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-xs text-text-secondary">
            {selectedIds.size > 0 ? `已选择 ${selectedIds.size} 个文档` : '全选'}
          </span>
        </div>
      )}

      {/* Document list */}
      <div ref={listRef} className="flex-1 overflow-auto divide-y divide-border-light">
        {documents.map((doc) => {
          const status = statusConfig[doc.syncStatus]
          const isSelected = selectedIds.has(doc.id)
          const isSynced = doc.syncStatus === 'synced' && doc.localPath
          
          return (
            <div
              key={doc.id}
              className={`px-4 py-3 hover:bg-bg-secondary transition-colors duration-150 group ${isSelected ? 'bg-accent/5' : ''}`}
              onClick={selectable ? () => handleToggleSelect(doc.id) : undefined}
              onDoubleClick={() => {
                // 双击预览
                if (isSynced && onPreview) {
                  onPreview(doc)
                }
              }}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                {selectable && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelect(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                )}
                
                {/* Document icon */}
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                
                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text-primary truncate">
                    {doc.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
                    {doc.localSyncedAt && (
                      <span>
                        同步于 {new Date(doc.localSyncedAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                    {doc.remoteUpdatedAt && (
                      <span>
                        更新于 {new Date(doc.remoteUpdatedAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Action buttons - show on hover */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Preview button */}
                  {isSynced && onPreview && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPreview(doc) }}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                      title="预览"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Open file button */}
                  {isSynced && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenFile(doc) }}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                      title="打开文件"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Show in folder button */}
                  {isSynced && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShowInFolder(doc) }}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                      title="在文件夹中显示"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Open in Yuque button */}
                  {bookInfo && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenInYuque(doc) }}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                      title="在语雀中打开"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Status badge */}
                <div className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${status.color} ${status.bg}`}>
                  {status.label}
                </div>
              </div>
            </div>
          )
        })}
        
        {/* Load more indicator */}
        {loadingMore && (
          <div className="px-4 py-3 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-text-secondary">加载更多...</span>
          </div>
        )}
        
        {/* Load more button (fallback) */}
        {hasMore && !loadingMore && onLoadMore && (
          <div className="px-4 py-3 flex items-center justify-center">
            <button
              onClick={onLoadMore}
              className="text-sm text-accent hover:text-accent-hover"
            >
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
