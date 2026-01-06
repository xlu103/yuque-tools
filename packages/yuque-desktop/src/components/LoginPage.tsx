import { useState, FormEvent } from 'react'
import { MacButton } from './ui/MacButton'
import { MacInput } from './ui/MacInput'

interface LoginPageProps {
  onLogin: (userName: string, password: string) => Promise<{ success: boolean; error?: string }>
  loading?: boolean
}

export function LoginPage({ onLogin, loading = false }: LoginPageProps) {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!userName.trim()) {
      setError('请输入用户名')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await onLogin(userName.trim(), password)
      if (!result.success) {
        setError(result.error || '登录失败，请重试')
      }
    } catch (err) {
      setError('登录失败，请检查网络连接')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary">
      {/* Titlebar drag region */}
      <div className="h-[52px] flex-shrink-0 titlebar-drag-region" />
      
      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">语雀桌面同步</h1>
            <p className="mt-2 text-sm text-text-secondary">登录你的语雀账号</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <MacInput
              label="用户名"
              type="text"
              placeholder="手机号/邮箱"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isSubmitting || loading}
              autoFocus
            />

            <MacInput
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || loading}
            />

            {error && (
              <div className="p-3 rounded-md bg-error/10 border border-error/20">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <MacButton
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting || loading}
              disabled={isSubmitting || loading}
              className="w-full mt-6"
            >
              {isSubmitting ? '登录中...' : '登录'}
            </MacButton>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-text-tertiary">
            使用语雀账号登录，同步你的知识库
          </p>
        </div>
      </div>
    </div>
  )
}
