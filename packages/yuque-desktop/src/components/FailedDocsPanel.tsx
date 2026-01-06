import { useState, useEffect, useCallback } from 'react'
import { useIsElectron, useToast } from '../hooks'
import { MacButton } from './ui/MacButton'
import { MacToolbar, ToolbarTitle, ToolbarGroup } from './ui/MacToolbar'

interface FailedDocument {
  id: string
  bookId: string
  bookName: string
  slug: string
  title: string
  updatedAt: string
}

interface FailedDocsPanelProps {
  onClose: () => void
}

export function FailedDocsPanel({ onClose }: FailedDocsPanelProps) {
  const isElectron = useIsElectron()
  const { showToast } = useToast()
  const [failedDocs, setFailedDocs] = useState<FailedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Load failed documents
  const loadFailedDocs = useCallback(async () => {
    if (!isElectron) {
      setLoading(false)
      return
    }

    try {
      const docs = await window.electronAPI['sync:getFailedDocs']()
      setFailedDocs(docs)
    } catch (error) {
      console.error('Failed to load failed docs:', error)
      showToast('error', '加载失败文档列表出错')
    } finally {
      setLoading(false)
    }
  }, [isElectron, showToast])

  useEffect(() => {
    loadFailedDocs()
  }, [loadFailedDocs])

  // Retry a failed document
  const handleRetry = async (docId: string) => {
    if (!isElectron) return
    
    setProcessingIds(prev => new Set(prev).add(docId))
    try {
      await window.electronAPI['sync:retryFailedDoc'](docId)
      showToast('success', '已重置状态，下次同步时将重试')
      // Remove from list
      setFailedDocs(prev => prev.filter(d => d.id !== docId))
    } catch (error) {
      console.error('Failed to retry doc:', error)
      showToast('error', '操作失败')
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    }
  }

  // Clear a failed document (mark as deleted)
  const handleClear = async (docId: string) => {
    if (!isElectron) return
    
    setProcessingIds(prev => new Set(prev).add(docId))
    try {
      await window.electronAPI['sync:clearFailedDoc'](docId)
      showToast('success', '已忽略该文档')
      // Remove from list
      setFailedDocs(prev => prev.filter(d => d.id !== docId))
    } catch (error) {
      console.error('Failed to clear doc:', error)
      showToast('error', '操作失败')
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(docId)
        return next
      })
    }
  }

  // Retry all failed documents
  const handleRetryAll = async () => {
    if (!isElectron || failedDocs.length === 0) return
    
    for (const doc of failedDocs) {
      try {
        await window.electronAPI['sync:retryFailedDoc'](doc.id)
      } catch (error) {
        console.error('Failed to retry doc:', doc.id, error)
      }
    }
    showToast('success', '已重置所有失败文档状态')
    setFailedDocs([])
  }

  // Clear all failed documents
  const handleClearAll = async () => {
    if (!isElectron || failedDocs.length === 0) return
    
    for (const doc of failedDocs) {
      try {
        await window.electronAPI['sync:clearFailedDoc'](doc.id)
      } catch (error) {
        console.error('Failed to clear doc:', doc.id, error)
      }
    }
    showToast('success', '已忽略所有失败文档')
    setFailedDocs([])
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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
        <ToolbarTitle>同步失败的文档 ({failedDocs.length})</ToolbarTitle>
        <div className="flex-1" />
        {failedDocs.length > 0 && (
          <ToolbarGroup>
            <MacButton variant="secondary" size="sm" onClick={handleRetryAll}>
              全部重试
            </MacButton>
            <MacButton variant="ghost" size="sm" onClick={handleClearAll}>
              全部忽略
            </MacButton>
          </ToolbarGroup>
        )}
      </MacToolbar>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : failedDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-12 h-12 text-success mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-text-secondary">没有同步失败的文档</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {failedDocs.map((doc) => {
              const isProcessing = processingIds.has(doc.id)
              
              return (
                <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Error icon */}
                  <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{doc.title}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {doc.bookName} · {formatDate(doc.updatedAt)}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <MacButton 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => handleRetry(doc.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '...' : '重试'}
                    </MacButton>
                    <MacButton 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleClear(doc.id)}
                      disabled={isProcessing}
                    >
                      忽略
                    </MacButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {failedDocs.length > 0 && (
        <div className="px-4 py-2 bg-bg-secondary border-t border-border-light">
          <p className="text-xs text-text-tertiary">
            提示：点击"重试"将在下次同步时重新下载该文档；点击"忽略"将跳过该文档不再同步。
          </p>
        </div>
      )}
    </div>
  )
}
