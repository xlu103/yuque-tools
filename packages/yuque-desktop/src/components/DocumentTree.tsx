import { useCallback, useMemo, useEffect, useState } from 'react'
import type { Document } from '../hooks'
import { useIsElectron, useSync, useToast } from '../hooks'
import { useTreeCollapseStore } from '../stores'
import { ContextMenu, useContextMenu, type ContextMenuItem } from './ui/ContextMenu'
import { Tooltip } from './ui/Tooltip'

interface DocumentTreeProps {
  documents: Document[]
  loading?: boolean
  emptyMessage?: string
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  selectable?: boolean
  bookInfo?: { userLogin: string; slug: string }
  bookId?: string
  onPreview?: (doc: Document) => void
  onDocumentSynced?: (doc: Document) => void
  hideFailedDocs?: boolean
}

interface TreeNode extends Document {
  children: TreeNode[]
  level: number
}

function buildDocumentTree(documents: Document[]): TreeNode[] {
  const nodesByUuid = new Map<string, TreeNode>()
  const nodesById = new Map<string, TreeNode>()
  const rootNodes: TreeNode[] = []

  documents.forEach(doc => {
    const node: TreeNode = {
      ...doc,
      children: [],
      level: doc.depth || 0
    }
    nodesById.set(doc.id, node)
    if (doc.uuid) {
      nodesByUuid.set(doc.uuid, node)
    }
  })

  documents.forEach(doc => {
    const node = nodesById.get(doc.id)
    if (!node) return

    if (doc.parentUuid) {
      const parent = nodesByUuid.get(doc.parentUuid) || nodesById.get(doc.parentUuid)
      if (parent) {
        parent.children.push(node)
      } else {
        rootNodes.push(node)
      }
    } else {
      rootNodes.push(node)
    }
  })

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortNodes(node.children)
      }
    })
  }
  
  sortNodes(rootNodes)
  return rootNodes
}

function DocumentTreeNode({
  node,
  isSelected,
  selectable,
  selectedIds,
  onToggleSelect,
  onPreview,
  onOpenFile,
  onOpenInYuque,
  onShowInFolder,
  onSyncDocument,
  onContextMenu,
  bookInfo,
  bookId,
  isCollapsed,
  onToggleCollapse,
  syncingDocId
}: {
  node: TreeNode
  isSelected: boolean
  selectable: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onPreview?: (doc: Document) => void
  onOpenFile: (doc: Document) => void
  onOpenInYuque: (doc: Document) => void
  onShowInFolder: (doc: Document) => void
  onSyncDocument: (doc: Document, force?: boolean, autoPreview?: boolean) => void
  onContextMenu: (e: React.MouseEvent, doc: Document) => void
  bookInfo?: { userLogin: string; slug: string }
  bookId?: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  syncingDocId: string | null
}) {
  const hasChildren = node.children.length > 0
  const isSynced = node.syncStatus === 'synced' && node.localPath
  const isFolder = node.docType === 'TITLE' || hasChildren
  const { isCollapsed: checkCollapsed, toggleNode, saveCollapseState } = useTreeCollapseStore()
  const isSyncing = syncingDocId === node.id

  const handleClick = () => {
    if (selectable) {
      onToggleSelect(node.id)
    } else if (hasChildren) {
      onToggleCollapse()
    } else if (isFolder) {
      // Do nothing for folders
    } else if (!isSynced && node.syncStatus !== 'synced') {
      // Click to sync unsynced documents
      onSyncDocument(node)
    } else if (isSynced && onPreview) {
      onPreview(node)
    }
  }

  return (
    <div className="animate-fade-in">
      <div
        className={`px-4 py-2 hover:bg-bg-secondary transition-all duration-150 group cursor-pointer flex items-start gap-2 ${
          isSelected ? 'bg-accent/5' : ''
        } ${isSyncing ? 'bg-accent/5' : ''}`}
        style={{ paddingLeft: `${16 + node.level * 20}px` }}
        onClick={handleClick}
        onContextMenu={(e) => !isFolder && onContextMenu(e, node)}
      >
        {/* Expand/collapse indicator */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded mt-0.5 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="flex-shrink-0 w-5 h-5" />
        )}

        {/* Checkbox */}
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(node.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent flex-shrink-0"
          />
        )}

        {/* Document icon with sync animation and status color */}
        <div className="flex-shrink-0 mt-0.5 relative">
          {isSyncing ? (
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : isFolder ? (
            <svg className="w-5 h-5 text-warning transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          ) : (
            <>
              <svg 
                className={`w-5 h-5 transition-colors ${
                  node.syncStatus === 'failed' ? 'text-error' : 
                  node.syncStatus === 'synced' ? 'text-text-tertiary' : 
                  'text-accent'
                }`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {/* Status indicator dot for non-synced documents */}
              {node.syncStatus !== 'synced' && (
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                  node.syncStatus === 'failed' ? 'bg-error' : 'bg-accent'
                }`} />
              )}
            </>
          )}
        </div>

        {/* Document info */}
        <div className="flex-1 min-w-0">
          <Tooltip content={
            node.localSyncedAt 
              ? `${node.title}\n同步于 ${new Date(node.localSyncedAt).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}`
              : node.title
          }>
            <h3 className={`text-sm font-medium text-text-primary truncate transition-colors ${isFolder ? 'font-semibold' : ''}`}>
              {node.title}
            </h3>
          </Tooltip>
        </div>
      </div>

      {/* Render children with animation */}
      {hasChildren && !isCollapsed && (
        <div className="animate-slide-in-up">
          {node.children.map((child) => {
            const childIsCollapsed = bookId ? checkCollapsed(bookId, child.id) : false
            return (
              <DocumentTreeNode
                key={child.id}
                node={child}
                isSelected={selectedIds.has(child.id)}
                selectable={selectable}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onPreview={onPreview}
                onOpenFile={onOpenFile}
                onOpenInYuque={onOpenInYuque}
                onShowInFolder={onShowInFolder}
                onSyncDocument={onSyncDocument}
                onContextMenu={onContextMenu}
                bookInfo={bookInfo}
                bookId={bookId}
                isCollapsed={childIsCollapsed}
                onToggleCollapse={() => {
                  if (bookId) {
                    toggleNode(bookId, child.id)
                    saveCollapseState(bookId)
                  }
                }}
                syncingDocId={syncingDocId}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DocumentTree({
  documents,
  loading,
  emptyMessage = '暂无文档',
  selectedIds = new Set(),
  onSelectionChange,
  selectable = false,
  bookInfo,
  bookId,
  onPreview,
  onDocumentSynced,
  hideFailedDocs = false
}: DocumentTreeProps) {
  const isElectron = useIsElectron()
  const { syncSingleDoc } = useSync()
  const { showToast } = useToast()
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null)
  
  const { 
    isCollapsed, 
    toggleNode, 
    loadCollapseState, 
    saveCollapseState 
  } = useTreeCollapseStore()

  // Filter out failed documents if hideFailedDocs is enabled
  const filteredDocuments = useMemo(() => {
    if (!hideFailedDocs) return documents
    return documents.filter(doc => doc.syncStatus !== 'failed')
  }, [documents, hideFailedDocs])

  const tree = useMemo(() => buildDocumentTree(filteredDocuments), [filteredDocuments])

  useEffect(() => {
    if (bookId) {
      loadCollapseState(bookId)
    }
  }, [bookId, loadCollapseState])

  // Sync single document
  const handleSyncDocument = useCallback(async (doc: Document, force: boolean = false, autoPreview: boolean = true) => {
    if (!bookId || syncingDocId) return
    
    setSyncingDocId(doc.id)
    try {
      const result = await syncSingleDoc({
        bookId,
        docId: doc.id,
        force
      })
      
      if (result.success && result.localPath) {
        showToast('success', `已同步: ${doc.title}`)
        const syncedDoc = { ...doc, localPath: result.localPath, syncStatus: 'synced' as const }
        
        // Notify parent to refresh document list
        if (onDocumentSynced) {
          onDocumentSynced(syncedDoc)
        }
        
        // Auto open preview after sync (for click-to-sync)
        if (autoPreview && onPreview) {
          onPreview(syncedDoc)
        }
      } else {
        showToast('error', result.error || '同步失败')
      }
    } catch (error) {
      showToast('error', '同步失败')
    } finally {
      setSyncingDocId(null)
    }
  }, [bookId, syncSingleDoc, showToast, syncingDocId, onDocumentSynced, onPreview])

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

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return
    const allSelected = documents.every((d) => selectedIds.has(d.id))
    if (allSelected) {
      const newSelection = new Set(selectedIds)
      documents.forEach((d) => newSelection.delete(d.id))
      onSelectionChange(newSelection)
    } else {
      const newSelection = new Set(selectedIds)
      documents.forEach((d) => newSelection.add(d.id))
      onSelectionChange(newSelection)
    }
  }, [documents, selectedIds, onSelectionChange])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, doc: Document) => {
    showContextMenu(e, doc)
  }, [showContextMenu])

  // Build context menu items
  const getContextMenuItems = useCallback((doc: Document): ContextMenuItem[] => {
    const isSynced = doc.syncStatus === 'synced' && doc.localPath
    const items: ContextMenuItem[] = []

    if (!isSynced) {
      items.push({
        label: '同步到本地并预览',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ),
        onClick: () => handleSyncDocument(doc, false, true)
      })
    }

    if (isSynced) {
      items.push({
        label: '重新同步 (覆盖本地)',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        onClick: () => handleSyncDocument(doc, true, false)
      })

      items.push({ label: '', divider: true, onClick: () => {} })

      items.push({
        label: '打开文件',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        ),
        onClick: () => handleOpenFile(doc)
      })

      items.push({
        label: '打开所在目录',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
        onClick: () => handleShowInFolder(doc)
      })
    }

    if (bookInfo) {
      if (items.length > 0 && !items[items.length - 1].divider) {
        items.push({ label: '', divider: true, onClick: () => {} })
      }

      items.push({
        label: '在浏览器中打开',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        ),
        onClick: () => handleOpenInYuque(doc)
      })
    }

    return items
  }, [bookInfo, handleSyncDocument, handleOpenFile, handleShowInFolder, handleOpenInYuque])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <p className="text-sm text-text-secondary">{emptyMessage}</p>
      </div>
    )
  }

  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id))
  const someSelected = documents.some((d) => selectedIds.has(d.id))

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

      {/* Document tree */}
      <div className="flex-1 overflow-auto">
        {tree.map((node) => {
          const nodeIsCollapsed = bookId ? isCollapsed(bookId, node.id) : false
          return (
            <DocumentTreeNode
              key={node.id}
              node={node}
              isSelected={selectedIds.has(node.id)}
              selectable={selectable}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onPreview={onPreview}
              onOpenFile={handleOpenFile}
              onOpenInYuque={handleOpenInYuque}
              onShowInFolder={handleShowInFolder}
              onSyncDocument={handleSyncDocument}
              onContextMenu={handleContextMenu}
              bookInfo={bookInfo}
              bookId={bookId}
              isCollapsed={nodeIsCollapsed}
              onToggleCollapse={() => {
                if (bookId) {
                  toggleNode(bookId, node.id)
                  saveCollapseState(bookId)
                }
              }}
              syncingDocId={syncingDocId}
            />
          )
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          items={getContextMenuItems(contextMenu.data)}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={hideContextMenu}
        />
      )}
    </div>
  )
}
