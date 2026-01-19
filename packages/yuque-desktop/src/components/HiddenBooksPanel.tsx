import { useMemo } from 'react'
import { useBookOrganizeStore } from '../stores'
import { useBooksStore } from '../stores/booksStore'
import { MacButton } from './ui/MacButton'
import { MacToolbar, ToolbarTitle } from './ui/MacToolbar'

interface HiddenBooksPanelProps {
  onClose: () => void
}

export function HiddenBooksPanel({ onClose }: HiddenBooksPanelProps) {
  const { hiddenBookIds, showBook } = useBookOrganizeStore()
  const { books } = useBooksStore()

  const hiddenBooks = useMemo(() => {
    return books.filter(book => hiddenBookIds.includes(book.id))
  }, [books, hiddenBookIds])

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary">
      {/* Toolbar */}
      <MacToolbar>
        <div className="pl-16">
          <MacButton variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </MacButton>
        </div>
        <ToolbarTitle>隐藏的知识库</ToolbarTitle>
      </MacToolbar>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6">
          {hiddenBooks.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-text-quaternary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p className="text-sm text-text-secondary">没有隐藏的知识库</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary mb-4">
                共 {hiddenBooks.length} 个隐藏的知识库
              </p>
              {hiddenBooks.map(book => (
                <div
                  key={book.id}
                  className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg border border-border hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-base flex-shrink-0">
                      {book.type === 'owner' ? '👤' : '👥'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {book.name}
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {book.docCount || 0} 个文档
                      </p>
                    </div>
                  </div>
                  <MacButton
                    variant="secondary"
                    size="sm"
                    onClick={() => showBook(book.id)}
                  >
                    显示
                  </MacButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
