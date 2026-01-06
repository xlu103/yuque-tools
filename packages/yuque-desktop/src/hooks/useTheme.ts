import { useEffect, useState, useCallback } from 'react'
import { useSettings } from './useIPC'

type Theme = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

export function useTheme() {
  const { getSettings, setSettings, isElectron } = useSettings()
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  // Get system preference
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }, [])

  // Apply theme to document
  const applyTheme = useCallback((t: Theme) => {
    const resolved = t === 'system' ? getSystemTheme() : t
    setResolvedTheme(resolved)
    
    // Set data-theme attribute on root element
    if (t === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', t)
    }
  }, [getSystemTheme])

  // Load theme from settings
  useEffect(() => {
    if (isElectron) {
      getSettings()
        .then((settings) => {
          const savedTheme = settings.theme || 'system'
          setThemeState(savedTheme)
          applyTheme(savedTheme)
        })
        .catch(console.error)
    } else {
      applyTheme('system')
    }
  }, [isElectron, getSettings, applyTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme === 'system') {
        setResolvedTheme(getSystemTheme())
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, getSystemTheme])

  // Set theme
  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    
    if (isElectron) {
      try {
        await setSettings({ theme: newTheme })
      } catch (error) {
        console.error('Failed to save theme:', error)
      }
    }
  }, [isElectron, setSettings, applyTheme])

  return {
    theme,
    resolvedTheme,
    setTheme,
    isDark: resolvedTheme === 'dark'
  }
}
