import { useEffect, useCallback } from 'react'
import { useIsElectron, useAuth } from './hooks'
import { useAuthStore } from './stores'
import { ToastProvider } from './components/ui'
import { LoginPage } from './components/LoginPage'
import { MainLayout } from './components/MainLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  const isElectron = useIsElectron()
  const { login, logout, getSession } = useAuth()
  const { session, isLoading, isInitialized, setSession, setLoading, setInitialized } = useAuthStore()

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
    }
    
    return result
  }, [isElectron, login, getSession, setSession])

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (!isElectron) return
    
    await logout()
    setSession(null)
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
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
