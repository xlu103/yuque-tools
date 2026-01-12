import { useEffect, useCallback, useState } from 'react'
import { useIsElectron, useAuth } from './hooks'
import { useAuthStore } from './stores'
import { ToastProvider } from './components/ui'
import { LoginPage } from './components/LoginPage'
import { MainLayout } from './components/MainLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

// Session expired modal component
function SessionExpiredModal({ onRelogin }: { onRelogin: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-primary rounded-lg shadow-xl p-6 max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary">登录已过期</h3>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          您的登录会话已过期，请重新登录以继续使用。
        </p>
        <button
          onClick={onRelogin}
          className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
        >
          重新登录
        </button>
      </div>
    </div>
  )
}

function App() {
  const isElectron = useIsElectron()
  const { login, logout, getSession } = useAuth()
  const { session, isLoading, isInitialized, setSession, setLoading, setInitialized } = useAuthStore()
  const [sessionExpired, setSessionExpired] = useState(false)

  // Initialize: check for existing session
  useEffect(() => {
    if (!isElectron) {
      setLoading(false)
      setInitialized(true)
      return
    }

    getSession()
      .then((existingSession) => {
        setSession(existingSession)
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
        setInitialized(true)
      })
  }, [isElectron, getSession, setSession, setLoading, setInitialized])

  // Global error listener for session expiration
  useEffect(() => {
    if (!isElectron) return

    // Listen for session expired events from main process
    const unsubscribe = window.electronAPI.on('auth:sessionExpired' as any, () => {
      console.log('Session expired event received')
      setSessionExpired(true)
    })

    // Also check for session expiration errors in IPC calls
    const originalInvoke = window.electronAPI
    
    // Create a global error handler
    const handleError = (error: any) => {
      const errorMessage = error?.message || String(error)
      if (errorMessage.includes('未登录') || errorMessage.includes('会话已过期') || errorMessage.includes('session expired')) {
        console.log('Session expired detected from error:', errorMessage)
        setSessionExpired(true)
      }
    }

    // Listen for unhandled promise rejections that might indicate session issues
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(event.reason)
    }
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      unsubscribe()
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [isElectron])

  // Handle login
  const handleLogin = useCallback(async (userName: string, password: string) => {
    if (!isElectron) {
      return { success: false, error: '请在 Electron 环境中运行' }
    }

    const result = await login({ userName, password })
    
    if (result.success) {
      // Refresh session after login
      const newSession = await getSession()
      setSession(newSession)
      setSessionExpired(false) // Clear expired state on successful login
    }
    
    return result
  }, [isElectron, login, getSession, setSession])

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (!isElectron) return
    
    await logout()
    setSession(null)
    setSessionExpired(false)
  }, [isElectron, logout, setSession])

  // Handle re-login (from expired modal)
  const handleRelogin = useCallback(async () => {
    if (!isElectron) return
    
    await logout()
    setSession(null)
    setSessionExpired(false)
  }, [isElectron, logout, setSession])

  // Show loading state
  if (!isInitialized || isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  // Not in Electron environment
  if (!isElectron) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-text-primary">语雀桌面同步工具</h1>
          <p className="mt-2 text-sm text-text-secondary">请在 Electron 环境中运行此应用</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        {session ? (
          <MainLayout session={session} onLogout={handleLogout} />
        ) : (
          <LoginPage onLogin={handleLogin} />
        )}
        {sessionExpired && session && <SessionExpiredModal onRelogin={handleRelogin} />}
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
