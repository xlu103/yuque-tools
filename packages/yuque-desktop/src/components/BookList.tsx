import type { KnowledgeBase } from '../hooks'
import { SidebarItem } from './ui/MacSidebar'

interface BookListProps {
  books: KnowledgeBase[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

export function BookList({ books, selectedId, onSelect, loading }: BookListProps) {
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
    <div className="space-y-0.5">
      {books.map((book) => (
        <SidebarItem
          key={book.id}
          icon={
            <span className="text-base">
              {book.type === 'owner' ? '👤' : '👥'}
            </span>
          }
          label={book.name}
          badge={book.docCount}
          selected={book.id === selectedId}
          onClick={() => onSelect(book.id)}
        />
      ))}
    </div>
  )
}
