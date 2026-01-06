import { useState, useEffect, useCallback } from 'react'
import { useSettings, useTheme, useToast } from '../hooks'
import type { AppSettings } from '../hooks'
import { MacButton } from './ui/MacButton'
import { MacSwitch } from './ui/MacSwitch'
import { MacToolbar, ToolbarTitle } from './ui/MacToolbar'

interface SettingsPanelProps {
  onClose: () => void
  onLogout: () => void
}

export function SettingsPanel({ onClose, onLogout }: SettingsPanelProps) {
  const { getSettings, setSettings, selectDirectory } = useSettings()
  const { setTheme } = useTheme()
  const { showToast } = useToast()
  
  const [settings, setLocalSettings] = useState<AppSettings>({
    syncDirectory: '',
    linebreak: true,
    latexcode: false,
    theme: 'system',
    autoSyncInterval: 0
  })
  const [loading, setLoading] = useState(true)

  // Load settings
  useEffect(() => {
    getSettings()
      .then((s) => {
        setLocalSettings(s)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [getSettings])

  // Handle directory selection
  const handleSelectDirectory = useCallback(async () => {
    const dir = await selectDirectory()
    if (dir) {
      setLocalSettings((prev) => ({ ...prev, syncDirectory: dir }))
      await setSettings({ syncDirectory: dir })
      showToast('success', '同步目录已更新')
    }
  }, [selectDirectory, setSettings, showToast])

  // Handle setting change
  const handleSettingChange = useCallback(async (key: keyof AppSettings, value: any) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    await setSettings({ [key]: value })
    
    if (key === 'theme') {
      setTheme(value)
    }
  }, [setSettings, setTheme])

  // Handle logout
  const handleLogout = useCallback(() => {
    if (confirm('确定要退出登录吗？')) {
      onLogout()
    }
  }, [onLogout])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary">
      {/* Toolbar - add left padding for macOS traffic lights */}
      <MacToolbar>
        <div className="pl-16">
          <MacButton variant="ghost" size="sm" onClick={onClose}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </MacButton>
        </div>
        <ToolbarTitle>设置</ToolbarTitle>
      </MacToolbar>

      {/* Settings content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-xl mx-auto p-6 space-y-8">
          {/* Sync directory */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-4">同步设置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">同步目录</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-3 py-2 bg-bg-secondary rounded-md text-sm text-text-primary truncate">
                    {settings.syncDirectory || '未设置'}
                  </div>
                  <MacButton variant="secondary" size="sm" onClick={handleSelectDirectory}>
                    选择
                  </MacButton>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">自动同步</label>
                <select
                  value={settings.autoSyncInterval}
                  onChange={(e) => handleSettingChange('autoSyncInterval', parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value={0}>关闭</option>
                  <option value={30}>每 30 分钟</option>
                  <option value={60}>每 1 小时</option>
                  <option value={720}>每 12 小时</option>
                  <option value={1440}>每 24 小时</option>
                </select>
                <p className="mt-1 text-xs text-text-tertiary">
                  开启后将按设定间隔自动同步所有知识库
                </p>
              </div>
            </div>
          </section>

          {/* Export options */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-4">导出选项</h2>
            <div className="space-y-4">
              <MacSwitch
                label="保留换行符"
                description="在导出的 Markdown 中保留原始换行"
                checked={settings.linebreak}
                onChange={(checked) => handleSettingChange('linebreak', checked)}
              />
              <MacSwitch
                label="导出 LaTeX 代码"
                description="将公式导出为 LaTeX 代码格式"
                checked={settings.latexcode}
                onChange={(checked) => handleSettingChange('latexcode', checked)}
              />
            </div>
          </section>

          {/* Theme */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-4">外观</h2>
            <div>
              <label className="block text-sm text-text-secondary mb-2">主题</label>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
          </section>

          {/* Account */}
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-4">账号</h2>
            <MacButton variant="danger" onClick={handleLogout}>
              退出登录
            </MacButton>
          </section>

          {/* About */}
          <section className="pt-4 border-t border-border-light">
            <p className="text-xs text-text-tertiary text-center">
              语雀桌面同步工具 v1.0.0
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
