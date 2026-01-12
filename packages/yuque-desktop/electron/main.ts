import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './db'
import { getSetting, setSetting } from './db/stores/settings'

let mainWindow: BrowserWindow | null = null

// Window state keys
const WINDOW_STATE_KEYS = {
  x: 'windowState.x',
  y: 'windowState.y',
  width: 'windowState.width',
  height: 'windowState.height',
  isMaximized: 'windowState.isMaximized'
}

// Get saved window state
function getWindowState(): { x?: number; y?: number; width: number; height: number; isMaximized: boolean } {
  try {
    const x = getSetting(WINDOW_STATE_KEYS.x)
    const y = getSetting(WINDOW_STATE_KEYS.y)
    const width = getSetting(WINDOW_STATE_KEYS.width)
    const height = getSetting(WINDOW_STATE_KEYS.height)
    const isMaximized = getSetting(WINDOW_STATE_KEYS.isMaximized)

    return {
      x: x ? parseInt(x, 10) : undefined,
      y: y ? parseInt(y, 10) : undefined,
      width: width ? parseInt(width, 10) : 1200,
      height: height ? parseInt(height, 10) : 800,
      isMaximized: isMaximized === 'true'
    }
  } catch {
    return { width: 1200, height: 800, isMaximized: false }
  }
}

// Save window state
function saveWindowState(window: BrowserWindow): void {
  try {
    const isMaximized = window.isMaximized()
    
    if (!isMaximized) {
      const bounds = window.getBounds()
      setSetting(WINDOW_STATE_KEYS.x, String(bounds.x))
      setSetting(WINDOW_STATE_KEYS.y, String(bounds.y))
      setSetting(WINDOW_STATE_KEYS.width, String(bounds.width))
      setSetting(WINDOW_STATE_KEYS.height, String(bounds.height))
    }
    
    setSetting(WINDOW_STATE_KEYS.isMaximized, String(isMaximized))
  } catch (error) {
    console.error('Failed to save window state:', error)
  }
}

const createWindow = () => {
  // Get saved window state
  const windowState = getWindowState()

  // Create the browser window.
  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native style
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'sidebar', // macOS vibrancy effect
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false  // 允许加载本地 file:// 资源
    }
  })

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize()
  }

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow)
    }
  })

  // Register IPC handlers with mainWindow reference for events
  registerIpcHandlers(ipcMain, mainWindow)

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// Register keyboard shortcuts
function registerShortcuts(): void {
  // Cmd+S: Sync (send to renderer)
  globalShortcut.register('CommandOrControl+S', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:sync')
    }
  })

  // Cmd+R: Refresh (send to renderer)
  globalShortcut.register('CommandOrControl+R', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:refresh')
    }
  })

  // Cmd+,: Settings (send to renderer)
  globalShortcut.register('CommandOrControl+,', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:settings')
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Initialize database
  initDatabase()
  
  createWindow()
  registerShortcuts()

  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on quit
app.on('before-quit', () => {
  closeDatabase()
})

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
})

// Export for use in IPC handlers
export { mainWindow }
