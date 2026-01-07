import { useState, useEffect, useCallback } from 'react'
import { useStatistics } from '../hooks'
import type { SyncStatistics } from '../hooks'
import { MacButton } from './ui/MacButton'
import { MacToolbar, ToolbarTitle } from './ui/MacToolbar'

interface StatisticsPanelProps {
  onClose: () => void
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${size.toFixed(i > 0 ? 2 : 0)} ${units[i]}`
}

/**
 * Format date to locale string
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '从未同步'
  try {
    return new Date(dateStr).toLocaleString('zh-CN')
  } catch {
    return dateStr
  }
}

export function StatisticsPanel({ onClose }: StatisticsPanelProps) {
  const { getStats } = useStatistics()
  const [stats, setStats] = useState<SyncStatistics | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load statistics:', error)
    } finally {
      setLoading(false)
    }
  }, [getStats])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary">
      {/* Toolbar - 统一样式，左侧留出 macOS 红绿灯按钮位置 */}
      <MacToolbar>
        <div className="pl-16">
          <MacButton variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </MacButton>
        </div>
        <ToolbarTitle>同步统计</ToolbarTitle>
        <div className="flex-1" />
        <MacButton variant="ghost" size="sm" onClick={loadStats} disabled={loading}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </MacButton>
      </MacToolbar>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                label="知识库" 
                value={stats.totalBooks.toString()} 
                icon="📚"
              />
              <StatCard 
                label="文档总数" 
                value={stats.totalDocuments.toString()} 
                icon="📄"
              />
              <StatCard 
                label="存储空间" 
                value={formatBytes(stats.totalStorageBytes)} 
                icon="💾"
              />
              <StatCard 
                label="上次同步" 
                value={formatDate(stats.lastSyncTime)} 
                icon="🕐"
                small
              />
            </div>

            {/* Document Status */}
            <div className="bg-bg-secondary rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-primary mb-3">文档状态分布</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatusItem label="已同步" value={stats.syncedDocuments} color="green" />
                <StatusItem label="新增" value={stats.newDocuments} color="blue" />
                <StatusItem label="已修改" value={stats.modifiedDocuments} color="yellow" />
                <StatusItem label="待同步" value={stats.pendingDocuments} color="gray" />
                <StatusItem label="同步失败" value={stats.failedDocuments} color="red" />
                <StatusItem label="已删除" value={stats.deletedDocuments} color="gray" />
              </div>
            </div>

            {/* Resources */}
            <div className="bg-bg-secondary rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-primary mb-3">资源统计</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🖼️</span>
                  <div>
                    <p className="text-xs text-text-secondary">图片</p>
                    <p className="text-sm font-medium text-text-primary">{stats.imageCount} 个</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📎</span>
                  <div>
                    <p className="text-xs text-text-secondary">附件</p>
                    <p className="text-sm font-medium text-text-primary">{stats.attachmentCount} 个</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Progress Bar */}
            {stats.totalDocuments > 0 && (
              <div className="bg-bg-secondary rounded-lg p-4">
                <h3 className="text-sm font-medium text-text-primary mb-3">同步进度</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>已同步 {stats.syncedDocuments} / {stats.totalDocuments}</span>
                    <span>{Math.round((stats.syncedDocuments / stats.totalDocuments) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(stats.syncedDocuments / stats.totalDocuments) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-text-secondary text-sm">无法加载统计数据</div>
          </div>
        )}
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  icon: string
  small?: boolean
}

function StatCard({ label, value, icon, small }: StatCardProps) {
  return (
    <div className="bg-bg-secondary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <p className={`font-medium text-text-primary ${small ? 'text-sm' : 'text-xl'}`}>
        {value}
      </p>
    </div>
  )
}

interface StatusItemProps {
  label: string
  value: number
  color: 'green' | 'blue' | 'yellow' | 'red' | 'gray'
}

function StatusItem({ label, value, color }: StatusItemProps) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-600',
    blue: 'bg-blue-500/10 text-blue-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
    red: 'bg-red-500/10 text-red-600',
    gray: 'bg-gray-500/10 text-gray-600'
  }

  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-bg-primary">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses[color]}`}>
        {value}
      </span>
    </div>
  )
}
