import { useState, useEffect, useCallback, useMemo } from 'react'
import type { KnowledgeBase } from '../hooks'
import { useBookOrganizeStore } from '../stores'
import { SidebarItem } from './ui/MacSidebar'

interface BookListProps {
  books: KnowledgeBase[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  bookId: string | null
  groupId: string | null
}

export function BookList({ books, selectedId, onSelect, loading }: BookListProps) {
  const {
    pinnedBookIds,
    groups,
    pinBook,
    unpinBook,
    isPinned,
    createGroup,
    deleteGroup,
    renameGroup,
    addBookToGroup,
    removeBookFromGroup,
    toggleGroupCollapse,
    getBookGroup,
    loadState
  } = useBookOrganizeStore()

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, bookId: null, groupId: null
  })
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  // Load state on mount
  useEffect(() => {
    loadState()
  }, [loadState])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }))
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Organize books into categories
  const organizedBooks = useMemo(() => {
    const pinned: KnowledgeBase[] = []
    const grouped: Map<string, KnowledgeBase[]> = new Map()
    const ungrouped: KnowledgeBase[] = []

    // Initialize grouped map
    groups.forEach(g => grouped.set(g.id, []))

    books.forEach(book => {
      if (isPinned(book.id)) {
        pinned.push(book)
      } else {
        const group = getBookGroup(book.id)
        if (group) {
          const groupBooks = grouped.get(group.id) || []
          groupBooks.push(book)
          grouped.set(group.id, groupBooks)
        } else {
          ungrouped.push(book)
        }
      }
    })

    // Sort pinned by pinnedBookIds order
    pinned.sort((a, b) => pinnedBookIds.indexOf(a.id) - pinnedBookIds.indexOf(b.id))

    return { pinned, grouped, ungrouped }
  }, [books, pinnedBookIds, groups, isPinned, getBookGroup])

  const handleContextMenu = useCallback((e: React.MouseEvent, bookId: string | null, groupId: string | null) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, bookId, groupId })
  }, [])

  const handleCreateGroup = useCallback(() => {
    if (newGroupName.trim()) {
      createGroup(newGroupName.trim())
      setNewGroupName('')
      setShowNewGroupInput(false)
    }
  }, [newGroupName, createGroup])

  const handleRenameGroup = useCallback((groupId: string) => {
    if (editingGroupName.trim()) {
      renameGroup(groupId, editingGroupName.trim())
      setEditingGroupId(null)
      setEditingGroupName('')
    }
  }, [editingGroupName, renameGroup])

  const renderBookItem = (book: KnowledgeBase, showPinIcon = false) => (
    <div
      key={book.id}
      onContextMenu={(e) => handleContextMenu(e, book.id, null)}
      className="relative group"
    >
      <SidebarItem
        icon={
          <span className="text-base">
            {showPinIcon && isPinned(book.id) ? '📌' : book.type === 'owner' ? '👤' : '👥'}
          </span>
        }
        label={book.name}
        badge={book.docCount}
        selected={book.id === selectedId}
        onClick={() => onSelect(book.id)}
      />
    </div>
  )

  if (loading) {
    return (
      <div className="px-2 py-4 text-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-2 text-xs text-text-secondary">加载中...</p>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="px-2 py-4 text-center">
        <p className="text-xs text-text-secondary">暂无知识库</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Pinned section */}
      {organizedBooks.pinned.length > 0 && (
        <div>
          <div className="px-2 py-1 text-xs text-text-tertiary font-medium flex items-center gap-1">
            <span>📌</span>
            <span>置顶</span>
          </div>
          <div className="space-y-0.5">
            {organizedBooks.pinned.map(book => renderBookItem(book, true))}
          </div>
        </div>
      )}

      {/* Custom groups */}
      {groups.map(group => {
        const groupBooks = organizedBooks.grouped.get(group.id) || []
        return (
          <div key={group.id}>
            <div
              className="px-2 py-1 text-xs text-text-tertiary font-medium flex items-center gap-1 cursor-pointer hover:bg-bg-secondary rounded"
              onClick={() => toggleGroupCollapse(group.id)}
              onContextMenu={(e) => handleContextMenu(e, null, group.id)}
            >
              <svg
                className={`w-3 h-3 transition-transform ${!group.collapsed ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {editingGroupId === group.id ? (
                <input
                  type="text"
                  value={editingGroupName}
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  onBlur={() => handleRenameGroup(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameGroup(group.id)
                    if (e.key === 'Escape') setEditingGroupId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-bg-secondary border border-border rounded px-1 text-text-primary"
                  autoFocus
                />
              ) : (
                <span className="flex-1">{group.name}</span>
              )}
              <span className="text-text-quaternary">({groupBooks.length})</span>
            </div>
            {!group.collapsed && (
              <div className="space-y-0.5 ml-2">
                {groupBooks.map(book => renderBookItem(book))}
                {groupBooks.length === 0 && (
                  <div className="px-2 py-1 text-xs text-text-quaternary italic">空分组</div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Ungrouped section */}
      {organizedBooks.ungrouped.length > 0 && (
        <div>
          {(organizedBooks.pinned.length > 0 || groups.length > 0) && (
            <div className="px-2 py-1 text-xs text-text-tertiary font-medium">其他</div>
          )}
          <div className="space-y-0.5">
            {organizedBooks.ungrouped.map(book => renderBookItem(book))}
          </div>
        </div>
      )}

      {/* New group input */}
      {showNewGroupInput && (
        <div className="px-2 py-1">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onBlur={() => {
              if (!newGroupName.trim()) setShowNewGroupInput(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup()
              if (e.key === 'Escape') {
                setShowNewGroupInput(false)
                setNewGroupName('')
              }
            }}
            placeholder="输入分组名称..."
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary"
            autoFocus
          />
        </div>
      )}

      {/* Add group button */}
      <button
        onClick={() => setShowNewGroupInput(true)}
        className="w-full px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary rounded flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>新建分组</span>
      </button>

      {/* Context menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-bg-primary border border-border rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.bookId && (
            <>
              {isPinned(contextMenu.bookId) ? (
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2"
                  onClick={() => {
                    unpinBook(contextMenu.bookId!)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                >
                  <span>📌</span>
                  <span>取消置顶</span>
                </button>
              ) : (
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2"
                  onClick={() => {
                    pinBook(contextMenu.bookId!)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                >
                  <span>📌</span>
                  <span>置顶</span>
                </button>
              )}
              
              {groups.length > 0 && (
                <>
                  <div className="border-t border-border-light my-1" />
                  <div className="px-3 py-1 text-xs text-text-tertiary">移动到分组</div>
                  {groups.map(group => (
                    <button
                      key={group.id}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2"
                      onClick={() => {
                        addBookToGroup(group.id, contextMenu.bookId!)
                        setContextMenu(prev => ({ ...prev, visible: false }))
                      }}
                    >
                      <span>📁</span>
                      <span>{group.name}</span>
                    </button>
                  ))}
                </>
              )}
              
              {getBookGroup(contextMenu.bookId) && (
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 text-error"
                  onClick={() => {
                    const group = getBookGroup(contextMenu.bookId!)
                    if (group) removeBookFromGroup(group.id, contextMenu.bookId!)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                >
                  <span>↩️</span>
                  <span>移出分组</span>
                </button>
              )}
            </>
          )}
          
          {contextMenu.groupId && (
            <>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2"
                onClick={() => {
                  const group = groups.find(g => g.id === contextMenu.groupId)
                  if (group) {
                    setEditingGroupId(group.id)
                    setEditingGroupName(group.name)
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }))
                }}
              >
                <span>✏️</span>
                <span>重命名</span>
              </button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 text-error"
                onClick={() => {
                  deleteGroup(contextMenu.groupId!)
                  setContextMenu(prev => ({ ...prev, visible: false }))
                }}
              >
                <span>🗑️</span>
                <span>删除分组</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
