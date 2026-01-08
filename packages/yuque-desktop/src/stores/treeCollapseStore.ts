import { create } from 'zustand'

const STORAGE_KEY_PREFIX = 'yuque-tree-collapse-'

interface TreeCollapseState {
  /** 按知识库 ID 存储的折叠节点集合 */
  collapsedNodes: Record<string, Set<string>>
  /** 切换节点折叠状态 */
  toggleNode: (bookId: string, nodeId: string) => void
  /** 检查节点是否折叠 */
  isCollapsed: (bookId: string, nodeId: string) => boolean
  /** 折叠所有节点 */
  collapseAll: (bookId: string, nodeIds: string[]) => void
  /** 展开所有节点 */
  expandAll: (bookId: string) => void
  /** 加载指定知识库的折叠状态 */
  loadCollapseState: (bookId: string) => void
  /** 保存指定知识库的折叠状态 */
  saveCollapseState: (bookId: string) => void
}

export const useTreeCollapseStore = create<TreeCollapseState>((set, get) => ({
  collapsedNodes: {},

  toggleNode: (bookId: string, nodeId: string) => {
    set((state) => {
      const bookNodes = state.collapsedNodes[bookId] || new Set<string>()
      const newBookNodes = new Set(bookNodes)
      
      if (newBookNodes.has(nodeId)) {
        newBookNodes.delete(nodeId)
      } else {
        newBookNodes.add(nodeId)
      }
      
      return {
        collapsedNodes: {
          ...state.collapsedNodes,
          [bookId]: newBookNodes
        }
      }
    })
  },

  isCollapsed: (bookId: string, nodeId: string) => {
    const { collapsedNodes } = get()
    const bookNodes = collapsedNodes[bookId]
    return bookNodes ? bookNodes.has(nodeId) : false
  },

  collapseAll: (bookId: string, nodeIds: string[]) => {
    set((state) => ({
      collapsedNodes: {
        ...state.collapsedNodes,
        [bookId]: new Set(nodeIds)
      }
    }))
  },

  expandAll: (bookId: string) => {
    set((state) => ({
      collapsedNodes: {
        ...state.collapsedNodes,
        [bookId]: new Set<string>()
      }
    }))
  },

  loadCollapseState: (bookId: string) => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${bookId}`)
      if (saved) {
        const nodeIds: string[] = JSON.parse(saved)
        set((state) => ({
          collapsedNodes: {
            ...state.collapsedNodes,
            [bookId]: new Set(nodeIds)
          }
        }))
      } else {
        // Default to all expanded (empty set)
        set((state) => ({
          collapsedNodes: {
            ...state.collapsedNodes,
            [bookId]: new Set<string>()
          }
        }))
      }
    } catch (error) {
      console.error('Failed to load collapse state:', error)
      // Default to all expanded on error
      set((state) => ({
        collapsedNodes: {
          ...state.collapsedNodes,
          [bookId]: new Set<string>()
        }
      }))
    }
  },

  saveCollapseState: (bookId: string) => {
    try {
      const { collapsedNodes } = get()
      const bookNodes = collapsedNodes[bookId]
      if (bookNodes) {
        const nodeIds = Array.from(bookNodes)
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${bookId}`, JSON.stringify(nodeIds))
      }
    } catch (error) {
      console.error('Failed to save collapse state:', error)
    }
  }
}))
