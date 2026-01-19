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
    getLastAccessed,
    hideBook,
    showBook,
    isHidden,
    sortType,
    setSortType,
    loadState
  } = useBookOrganizeStore()

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, bookId: null, groupId: null
  })
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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

    // Filter out hidden books and apply search
    const visibleBooks = books.filter(book => {
      if (isHidden(book.id)) return false
      if (searchQuery.trim()) {
        return book.name.toLowerCase().includes(searchQuery.toLowerCase())
      }
      return true
    })

    visibleBooks.forEach(book => {
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

    // Sort function based on sortType
    const sortBooks = (a: KnowledgeBase, b: KnowledgeBase) => {
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
    }

    // Sort pinned by pinnedBookIds order (manual order)
    pinned.sort((a, b) => pinnedBookIds.indexOf(a.id) - pinnedBookIds.indexOf(b.id))

    // Sort ungrouped
    ungrouped.sort(sortBooks)

    // Sort books within each group
    grouped.forEach((groupBooks) => {
      groupBooks.sort(sortBooks)
    })

    return { pinned, grouped, ungrouped }
  }, [books, pinnedBookIds, groups, isPinned, getBookGroup, getLastAccessed, isHidden, searchQuery, sortType])

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
      {/* Search and Sort Controls - Compact Single Row */}
      <div className="px-2">
        <div className="flex items-center gap-1.5">
          {/* Compact Search box */}
          <div className="relative flex-1">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="w-full pl-6 pr-6 py-1 text-xs bg-bg-secondary border border-border rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort Icon Buttons */}
          <div className="flex items-center gap-0.5 bg-bg-secondary border border-border rounded p-0.5">
            <button
              onClick={() => setSortType('lastAccessed')}
              title="按访问时间"
              className={`p-1 rounded transition-colors ${
                sortType === 'lastAccessed' 
                  ? 'bg-accent text-white' 
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setSortType('name')}
              title="按名称"
              className={`p-1 rounded transition-colors ${
                sortType === 'name' 
                  ? 'bg-accent text-white' 
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
            <button
              onClick={() => setSortType('docCount')}
              title="按文档数"
              className={`p-1 rounded transition-colors ${
                sortType === 'docCount' 
                  ? 'bg-accent text-white' 
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Empty state for search */}
      {searchQuery && organizedBooks.pinned.length === 0 && organizedBooks.ungrouped.length === 0 && Array.from(organizedBooks.grouped.values()).every(g => g.length === 0) && (
        <div className="px-2 py-4 text-center">
          <p className="text-xs text-text-secondary">未找到匹配的知识库</p>
        </div>
      )}

      {/* Pinned section */}
      {organizedBooks.pinned.length > 0 && (
        <div>
          <div className="px-2 py-1 text-xs text-text-tertiary font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5v5c0 .55.45 1 1 1s1-.45 1-1v-5h5v-2l-2-2z"/>
            </svg>
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
        className="w-full px-2 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded flex items-center gap-1.5 transition-colors"
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
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 transition-colors"
                  onClick={() => {
                    unpinBook(contextMenu.bookId!)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5v5c0 .55.45 1 1 1s1-.45 1-1v-5h5v-2l-2-2z"/>
                  </svg>
                  <span>取消置顶</span>
                </button>
              ) : (
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 transition-colors"
                  onClick={() => {
                    pinBook(contextMenu.bookId!)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5v5c0 .55.45 1 1 1s1-.45 1-1v-5h5v-2l-2-2z"/>
                  </svg>
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
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 transition-colors"
                      onClick={() => {
                        addBookToGroup(group.id, contextMenu.bookId!)
                        setContextMenu(prev => ({ ...prev, visible: false }))
                      }}
                    >
                      <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{group.name}</span>
                    </button>
                  ))}
                </>
              )}
              
              {getBookGroup(contextMenu.bookId) && (
                <button
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 text-error transition-colors"
                  onClick={() => {
                    const group = getBookGroup(contextMenu.bookId!)
                    if (group) removeBookFromGroup(group.id, contextMenu.bookId!)
                    setContextMenu(prev => ({ ...prev, visible: false }))
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span>移出分组</span>
                </button>
              )}

              <div className="border-t border-border-light my-1" />
              
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 transition-colors"
                onClick={() => {
                  hideBook(contextMenu.bookId!)
                  setContextMenu(prev => ({ ...prev, visible: false }))
                }}
              >
                <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                <span>隐藏</span>
              </button>
            </>
          )}
          
          {contextMenu.groupId && (
            <>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 transition-colors"
                onClick={() => {
                  const group = groups.find(g => g.id === contextMenu.groupId)
                  if (group) {
                    setEditingGroupId(group.id)
                    setEditingGroupName(group.name)
                  }
                  setContextMenu(prev => ({ ...prev, visible: false }))
                }}
              >
                <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>重命名</span>
              </button>
              <button
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 text-error transition-colors"
                onClick={() => {
                  deleteGroup(contextMenu.groupId!)
                  setContextMenu(prev => ({ ...prev, visible: false }))
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>删除分组</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
