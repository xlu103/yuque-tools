import { useState, useEffect } from 'react'
import { useIsElectron } from '../hooks'
import { MacButton } from './ui/MacButton'
import { MacToolbar, ToolbarTitle } from './ui/MacToolbar'

interface SyncHistoryItem {
  id: number
  startedAt: string
  completedAt: string | null
  status: 'running' | 'success' | 'failed' | 'cancelled'
  totalDocs: number
  syncedDocs: number
  failedDocs: number
  errorMessage: string | null
}

interface SyncHistoryPanelProps {
  onClose: () => void
}

const statusConfig = {
  running: { label: '进行中', color: 'text-info', bg: 'bg-info/10', icon: '🔄' },
  success: { label: '成功', color: 'text-success', bg: 'bg-success/10', icon: '✓' },
  failed: { label: '失败', color: 'text-error', bg: 'bg-error/10', icon: '✗' },
  cancelled: { label: '已取消', color: 'text-warning', bg: 'bg-warning/10', icon: '⊘' }
}

export function SyncHistoryPanel({ onClose }: SyncHistoryPanelProps) {
  const isElectron = useIsElectron()
  const [history, setHistory] = useState<SyncHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Load history
  useEffect(() => {
    if (!isElectron) {
      setLoading(false)
      return
    }

    window.electronAPI['sync:getHistory'](50)
      .then((items) => {
        setHistory(items)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isElectron])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '进行中'
    const duration = new Date(end).getTime() - new Date(start).getTime()
    const seconds = Math.floor(duration / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分${seconds % 60}秒`
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary">
      {/* Toolbar */}
      <MacToolbar>
        <MacButton variant="ghost" size="sm" onClick={onClose}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </MacButton>
        <ToolbarTitle>同步历史</ToolbarTitle>
      </MacToolbar>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-text-secondary">暂无同步记录</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {history.map((item) => {
              const status = statusConfig[item.status]
              const isExpanded = expandedId === item.id
              
              return (
                <div key={item.id} className="px-4 py-3">
                  <div 
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {/* Status icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status.bg}`}>
                      <span className="text-sm">{status.icon}</span>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {item.syncedDocs}/{item.totalDocs} 个文档
                        </span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {formatDate(item.startedAt)} · {formatDuration(item.startedAt, item.completedAt)}
                      </p>
                    </div>
                    
                    {/* Expand icon */}
                    <svg 
                      className={`w-4 h-4 text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  
                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-11 p-3 bg-bg-secondary rounded-md text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">开始时间</span>
                        <span className="text-text-primary">{formatDate(item.startedAt)}</span>
                      </div>
                      {item.completedAt && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">完成时间</span>
                          <span className="text-text-primary">{formatDate(item.completedAt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-text-secondary">总文档数</span>
                        <span className="text-text-primary">{item.totalDocs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">已同步</span>
                        <span className="text-success">{item.syncedDocs}</span>
                      </div>
                      {item.failedDocs > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">失败</span>
                          <span className="text-error">{item.failedDocs}</span>
                        </div>
                      )}
                      {item.errorMessage && (
                        <div className="pt-2 border-t border-border-light">
                          <p className="text-text-secondary mb-1">错误信息</p>
                          <p className="text-error whitespace-pre-wrap">{item.errorMessage}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
