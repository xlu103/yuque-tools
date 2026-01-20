import { useState, useMemo } from 'react'
import type { KnowledgeBase, Document } from '../hooks'
import { useBookOrganizeStore } from '../stores'

const NOTES_BOOK_ID = '__notes__'

interface AllBooksViewProps {
  books: KnowledgeBase[]
  allDocuments: Map<string, Document[]>
  onSelectBook: (bookId: string) => void
  onSelectDocument: (bookId: string, doc: Document) => void
}

export function AllBooksView({ books, allDocuments, onSelectBook, onSelectDocument }: AllBooksViewProps) {
  const {
    pinnedBookIds,
    groups,
    pinBook,
    unpinBook,
    isPinned,
    addBookToGroup,
    removeBookFromGroup,
    getBookGroup,
    hideBook,
    isHidden
  } = useBookOrganizeStore()

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    bookId: string | null
  }>({ visible: false, x: 0, y: 0, bookId: null })

  // Organize books
  const organizedBooks = useMemo(() => {
    const pinned: KnowledgeBase[] = []
    const regular: KnowledgeBase[] = []
    let notesBook: KnowledgeBase | null = null

    books.forEach(book => {
      if (isHidden(book.id)) return
      
      if (book.id === NOTES_BOOK_ID) {
        notesBook = book
      } else if (isPinned(book.id)) {
        pinned.push(book)
      } else {
        regular.push(book)
      }
    })

    // Sort pinned by order
    pinned.sort((a, b) => pinnedBookIds.indexOf(a.id) - pinnedBookIds.indexOf(b.id))
    
    // Sort regular by name
    regular.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

    return { pinned, regular, notesBook }
  }, [books, pinnedBookIds, isPinned, isHidden])

  // Get recent documents for a book (top 5)
  const getRecentDocs = (bookId: string): Document[] => {
    const docs = allDocuments.get(bookId) || []
    return docs
      .filter(d => d.docType !== 'TITLE' && d.syncStatus === 'synced')
      .sort((a, b) => {
        const timeA = a.localSyncedAt ? new Date(a.localSyncedAt).getTime() : 0
        const timeB = b.localSyncedAt ? new Date(b.localSyncedAt).getTime() : 0
        return timeB - timeA
      })
      .slice(0, 5)
  }

  const handleContextMenu = (e: React.MouseEvent, bookId: string) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, bookId })
  }

  // Close context menu
  useState(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }))
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  })

  const renderBookCard = (book: KnowledgeBase) => {
    const recentDocs = getRecentDocs(book.id)
    const group = getBookGroup(book.id)
    const pinned = isPinned(book.id)

    return (
      <div
        key={book.id}
        className="bg-bg-primary border border-border rounded-xl p-4 hover:border-accent hover:shadow-md transition-all group"
        onContextMenu={(e) => handleContextMenu(e, book.id)}
      >
        {/* Book header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-lg bg-bg-tertiary flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">
              {book.type === 'owner' ? '👤' : '👥'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className="text-sm font-semibold text-text-primary truncate cursor-pointer hover:text-accent"
                onClick={() => onSelectBook(book.id)}
              >
                {book.name}
              </h3>
              {pinned && (
                <svg className="w-3 h-3 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5v5c0 .55.45 1 1 1s1-.45 1-1v-5h5v-2l-2-2z"/>
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span>{book.docCount} 个文档</span>
              {group && (
                <>
                  <span>•</span>
                  <span className="truncate">{group.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent documents */}
        {recentDocs.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs text-text-tertiary mb-2">最近更新</div>
            {recentDocs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-secondary cursor-pointer group/doc transition-colors"
                onClick={() => onSelectDocument(book.id, doc)}
              >
                <svg className="w-3 h-3 text-text-tertiary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs text-text-primary truncate flex-1 group-hover/doc:text-accent">
                  {doc.title}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-text-quaternary text-center py-4">
            暂无已同步文档
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-2">所有知识库</h1>
          <p className="text-sm text-text-secondary">
            共 {books.filter(b => !isHidden(b.id) && b.id !== NOTES_BOOK_ID).length} 个知识库
          </p>
        </div>

        {/* Notes book - special card */}
        {organizedBooks.notesBook && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text-tertiary mb-3">小记</h2>
            <div className="grid grid-cols-1">
              {renderBookCard(organizedBooks.notesBook)}
            </div>
          </div>
        )}

        {/* Pinned books */}
        {organizedBooks.pinned.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text-tertiary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5v5c0 .55.45 1 1 1s1-.45 1-1v-5h5v-2l-2-2z"/>
              </svg>
              置顶知识库
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizedBooks.pinned.map(book => renderBookCard(book))}
            </div>
          </div>
        )}

        {/* Regular books */}
        {organizedBooks.regular.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-text-tertiary mb-3">全部知识库</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizedBooks.regular.map(book => renderBookCard(book))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {organizedBooks.pinned.length === 0 && organizedBooks.regular.length === 0 && !organizedBooks.notesBook && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-quaternary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm text-text-secondary">暂无知识库</p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.bookId && (
        <div
          className="fixed bg-bg-primary border border-border rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
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
        </div>
      )}
    </div>
  )
}
