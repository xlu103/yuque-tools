import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Document } from '../hooks'
import { useDebounce } from '../hooks'

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
  loadingMore = false
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 200)
  const listRef = useRef<HTMLDivElement>(null)

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

  // Filter by search query (debounced)
  const filteredDocs = useMemo(() => {
    if (!debouncedSearch) return documents
    const query = debouncedSearch.toLowerCase()
    return documents.filter(d => d.title.toLowerCase().includes(query))
  }, [documents, debouncedSearch])

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return
    
    const allSelected = filteredDocs.every(d => selectedIds.has(d.id))
    
    if (allSelected) {
      // Deselect all
      const newSelection = new Set(selectedIds)
      filteredDocs.forEach(d => newSelection.delete(d.id))
      onSelectionChange(newSelection)
    } else {
      // Select all
      const newSelection = new Set(selectedIds)
      filteredDocs.forEach(d => newSelection.add(d.id))
      onSelectionChange(newSelection)
    }
  }, [filteredDocs, selectedIds, onSelectionChange])

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

  const allSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedIds.has(d.id))
  const someSelected = filteredDocs.some(d => selectedIds.has(d.id))

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border-light">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Select all header */}
      {selectable && filteredDocs.length > 0 && (
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
        {filteredDocs.map((doc) => {
          const status = statusConfig[doc.syncStatus]
          const isSelected = selectedIds.has(doc.id)
          
          return (
            <div
              key={doc.id}
              className={`px-4 py-3 hover:bg-bg-secondary transition-colors duration-150 ${isSelected ? 'bg-accent/5' : ''}`}
              onClick={selectable ? () => handleToggleSelect(doc.id) : undefined}
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

      {/* No results */}
      {filteredDocs.length === 0 && searchQuery && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-text-secondary">未找到匹配的文档</p>
        </div>
      )}
    </div>
  )
}
