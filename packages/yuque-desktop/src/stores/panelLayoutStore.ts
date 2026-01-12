import { create } from 'zustand'

// Panel width constraints
export const PANEL_CONSTRAINTS = {
  sidebar: { min: 180, max: 400, default: 220 },
  preview: { min: 300, max: 800, default: 500 },
  documentList: { min: 300, max: 800, default: 400 }
}

const STORAGE_KEY = 'yuque-panel-layout'

/**
 * Clamp a width value to the specified min/max constraints
 */
export function clampWidth(width: number, min: number, max: number): number {
  if (width < min) return min
  if (width > max) return max
  return width
}

interface PanelLayoutState {
  /** 左侧边栏宽度 */
  sidebarWidth: number
  /** 右侧预览面板宽度 */
  previewWidth: number
  /** 文档列表宽度 */
  documentListWidth: number
  /** 设置侧边栏宽度 */
  setSidebarWidth: (width: number) => void
  /** 设置预览面板宽度 */
  setPreviewWidth: (width: number) => void
  /** 设置文档列表宽度 */
  setDocumentListWidth: (width: number) => void
  /** 从 localStorage 加载布局 */
  loadLayout: () => void
  /** 保存布局到 localStorage */
  saveLayout: () => void
}

export const usePanelLayoutStore = create<PanelLayoutState>((set, get) => ({
  sidebarWidth: PANEL_CONSTRAINTS.sidebar.default,
  previewWidth: PANEL_CONSTRAINTS.preview.default,
  documentListWidth: PANEL_CONSTRAINTS.documentList.default,

  setSidebarWidth: (width: number) => {
    const clamped = clampWidth(
      width,
      PANEL_CONSTRAINTS.sidebar.min,
      PANEL_CONSTRAINTS.sidebar.max
    )
    set({ sidebarWidth: clamped })
  },

  setPreviewWidth: (width: number) => {
    const clamped = clampWidth(
      width,
      PANEL_CONSTRAINTS.preview.min,
      PANEL_CONSTRAINTS.preview.max
    )
    set({ previewWidth: clamped })
  },

  setDocumentListWidth: (width: number) => {
    const clamped = clampWidth(
      width,
      PANEL_CONSTRAINTS.documentList.min,
      PANEL_CONSTRAINTS.documentList.max
    )
    set({ documentListWidth: clamped })
  },

  loadLayout: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const sidebarWidth = clampWidth(
          parsed.sidebarWidth ?? PANEL_CONSTRAINTS.sidebar.default,
          PANEL_CONSTRAINTS.sidebar.min,
          PANEL_CONSTRAINTS.sidebar.max
        )
        const previewWidth = clampWidth(
          parsed.previewWidth ?? PANEL_CONSTRAINTS.preview.default,
          PANEL_CONSTRAINTS.preview.min,
          PANEL_CONSTRAINTS.preview.max
        )
        const documentListWidth = clampWidth(
          parsed.documentListWidth ?? PANEL_CONSTRAINTS.documentList.default,
          PANEL_CONSTRAINTS.documentList.min,
          PANEL_CONSTRAINTS.documentList.max
        )
        set({ sidebarWidth, previewWidth, documentListWidth })
      }
    } catch (error) {
      console.error('Failed to load panel layout:', error)
      // Use defaults on error
    }
  },

  saveLayout: () => {
    try {
      const { sidebarWidth, previewWidth, documentListWidth } = get()
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sidebarWidth, previewWidth, documentListWidth })
      )
    } catch (error) {
      console.error('Failed to save panel layout:', error)
    }
  }
}))
