import { useCallback, useMemo, useEffect } from 'react'
import type { Document } from '../hooks'
import { useIsElectron } from '../hooks'
import { useTreeCollapseStore } from '../stores'

interface DocumentTreeProps {
  documents: Document[]
  loading?: boolean
  emptyMessage?: string
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  selectable?: boolean
  bookInfo?: { userLogin: string; slug: string }
  bookId?: string  // 新增：用于折叠状态持久化
  onPreview?: (doc: Document) => void
}

interface TreeNode extends Document {
  children: TreeNode[]
  level: number
}

const statusConfig = {
  synced: { label: '已同步', color: 'text-success', bg: 'bg-success/10' },
  pending: { label: '待同步', color: 'text-warning', bg: 'bg-warning/10' },
  modified: { label: '已修改', color: 'text-info', bg: 'bg-info/10' },
  new: { label: '新增', color: 'text-accent', bg: 'bg-accent/10' },
  deleted: { label: '已删除', color: 'text-error', bg: 'bg-error/10' },
  failed: { label: '同步失败', color: 'text-error', bg: 'bg-error/10' }
}

/**
 * Build tree structure from flat document list
 */
function buildDocumentTree(documents: Document[]): TreeNode[] {
  // Create maps for quick lookup - index by both uuid and id
  const nodesByUuid = new Map<string, TreeNode>()
  const nodesById = new Map<string, TreeNode>()
  const rootNodes: TreeNode[] = []

  // First pass: create all nodes and index them
  documents.forEach(doc => {
    const node: TreeNode = {
      ...doc,
      children: [],
      level: doc.depth || 0
    }
    
    // Index by id (always available)
    nodesById.set(doc.id, node)
    
    // Also index by uuid if available
    if (doc.uuid) {
      nodesByUuid.set(doc.uuid, node)
    }
  })

  // Second pass: build tree structure
  documents.forEach(doc => {
    const node = nodesById.get(doc.id)
    if (!node) return

    if (doc.parentUuid) {
      // Try to find parent by uuid first, then by id
      const parent = nodesByUuid.get(doc.parentUuid) || nodesById.get(doc.parentUuid)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent not found, treat as root
        rootNodes.push(node)
      }
    } else {
      // No parent, it's a root node
      rootNodes.push(node)
    }
  })

  // Sort root nodes and children by sortOrder
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
  bookInfo,
  bookId,
  isCollapsed,
  onToggleCollapse
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
  bookInfo?: { userLogin: string; slug: string }
  bookId?: string
  isCollapsed: boolean
  onToggleCollapse: () => void
}) {
  const hasChildren = node.children.length > 0
  const isSynced = node.syncStatus === 'synced' && node.localPath
  const status = statusConfig[node.syncStatus]
  const isFolder = node.docType === 'TITLE' || hasChildren  // 有子节点也算文件夹
  const { isCollapsed: checkCollapsed, toggleNode, saveCollapseState } = useTreeCollapseStore()

  return (
    <div>
      <div
        className={`px-4 py-2 hover:bg-bg-secondary transition-colors duration-150 group cursor-pointer flex items-start gap-2 ${
          isSelected ? 'bg-accent/5' : ''
        }`}
        style={{ paddingLeft: `${16 + node.level * 20}px` }}
        onClick={() => {
          if (selectable) {
            onToggleSelect(node.id)
          } else if (hasChildren) {
            // 单击有子节点的项目直接折叠/展开
            onToggleCollapse()
          } else if (isSynced && onPreview && !isFolder) {
            onPreview(node)
          }
        }}
      >
        {/* Expand/collapse indicator - 点击可折叠 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded mt-0.5"
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

        {/* Document icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isFolder ? (
            <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </div>

        {/* Document info */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium text-text-primary truncate ${isFolder ? 'font-semibold' : ''}`}>
            {node.title}
          </h3>
          {!isFolder && node.localSyncedAt && (
            <div className="mt-0.5 text-xs text-text-secondary">
              同步于{' '}
              {new Date(node.localSyncedAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isFolder && (
          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isSynced && onPreview && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(node)
                }}
                className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                title="预览"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            )}

            {isSynced && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenFile(node)
                }}
                className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                title="打开文件"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </button>
            )}

            {isSynced && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowInFolder(node)
                }}
                className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                title="在文件夹中显示"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </button>
            )}

            {bookInfo && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenInYuque(node)
                }}
                className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                title="在语雀中打开"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Status badge */}
        <div className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${status.color} ${status.bg}`}>
          {status.label}
        </div>
      </div>

      {/* Render children */}
      {hasChildren && !isCollapsed && (
        <div>
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
                bookInfo={bookInfo}
                bookId={bookId}
                isCollapsed={childIsCollapsed}
                onToggleCollapse={() => {
                  if (bookId) {
                    toggleNode(bookId, child.id)
                    saveCollapseState(bookId)
                  }
                }}
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
  onPreview
}: DocumentTreeProps) {
  const isElectron = useIsElectron()
  const { 
    isCollapsed, 
    toggleNode, 
    collapseAll, 
    expandAll, 
    loadCollapseState, 
    saveCollapseState 
  } = useTreeCollapseStore()

  // Build tree structure
  const tree = useMemo(() => {
    return buildDocumentTree(documents)
  }, [documents])

  // Get all folder node IDs for collapse all functionality (use id for consistency)
  const folderNodeIds = useMemo(() => {
    const ids: string[] = []
    const collectFolderIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          ids.push(node.id)  // Use id instead of uuid
          collectFolderIds(node.children)
        }
      })
    }
    collectFolderIds(tree)
    return ids
  }, [tree])

  // Load collapse state when bookId changes
  useEffect(() => {
    if (bookId) {
      loadCollapseState(bookId)
    }
  }, [bookId, loadCollapseState])

  // Handle collapse all
  const handleCollapseAll = useCallback(() => {
    if (bookId) {
      collapseAll(bookId, folderNodeIds)
      saveCollapseState(bookId)
    }
  }, [bookId, folderNodeIds, collapseAll, saveCollapseState])

  // Handle expand all
  const handleExpandAll = useCallback(() => {
    if (bookId) {
      expandAll(bookId)
      saveCollapseState(bookId)
    }
  }, [bookId, expandAll, saveCollapseState])

  // File operations
  const handleOpenFile = useCallback(
    async (doc: Document) => {
      if (!isElectron || !doc.localPath) return
      try {
        const result = await window.electronAPI['file:open'](doc.localPath)
        if (!result.success) {
          console.error('Failed to open file:', result.error)
        }
      } catch (error) {
        console.error('Failed to open file:', error)
      }
    },
    [isElectron]
  )

  const handleOpenInYuque = useCallback(
    async (doc: Document) => {
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
    },
    [isElectron, bookInfo]
  )

  const handleShowInFolder = useCallback(
    async (doc: Document) => {
      if (!isElectron || !doc.localPath) return
      try {
        const result = await window.electronAPI['file:showInFolder'](doc.localPath)
        if (!result.success) {
          console.error('Failed to show in folder:', result.error)
        }
      } catch (error) {
        console.error('Failed to show in folder:', error)
      }
    },
    [isElectron]
  )

  const handleToggleSelect = useCallback(
    (docId: string) => {
      if (!onSelectionChange) return

      const newSelection = new Set(selectedIds)
      if (newSelection.has(docId)) {
        newSelection.delete(docId)
      } else {
        newSelection.add(docId)
      }
      onSelectionChange(newSelection)
    },
    [selectedIds, onSelectionChange]
  )

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

  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id))
  const someSelected = documents.some((d) => selectedIds.has(d.id))

  return (
    <div className="flex flex-col h-full">
      {/* Collapse/Expand toolbar */}
      {folderNodeIds.length > 0 && (
        <div className="px-4 py-2 border-b border-border-light bg-bg-secondary flex items-center gap-2">
          <button
            onClick={handleCollapseAll}
            className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors flex items-center gap-1"
            title="全部折叠"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            <span>全部折叠</span>
          </button>
          <button
            onClick={handleExpandAll}
            className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors flex items-center gap-1"
            title="全部展开"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>全部展开</span>
          </button>
        </div>
      )}

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
              bookInfo={bookInfo}
              bookId={bookId}
              isCollapsed={nodeIsCollapsed}
              onToggleCollapse={() => {
                if (bookId) {
                  toggleNode(bookId, node.id)
                  saveCollapseState(bookId)
                }
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
