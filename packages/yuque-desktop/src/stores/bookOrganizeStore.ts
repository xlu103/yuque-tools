import { create } from 'zustand'

const STORAGE_KEY = 'yuque-book-organize'

export interface BookGroup {
  id: string
  name: string
  bookIds: string[]
  collapsed: boolean
}

interface BookOrganizeState {
  /** 置顶的知识库 ID 列表 */
  pinnedBookIds: string[]
  /** 自定义分组 */
  groups: BookGroup[]
  /** 添加置顶 */
  pinBook: (bookId: string) => void
  /** 取消置顶 */
  unpinBook: (bookId: string) => void
  /** 检查是否置顶 */
  isPinned: (bookId: string) => boolean
  /** 创建分组 */
  createGroup: (name: string) => string
  /** 删除分组 */
  deleteGroup: (groupId: string) => void
  /** 重命名分组 */
  renameGroup: (groupId: string, name: string) => void
  /** 添加知识库到分组 */
  addBookToGroup: (groupId: string, bookId: string) => void
  /** 从分组移除知识库 */
  removeBookFromGroup: (groupId: string, bookId: string) => void
  /** 切换分组折叠状态 */
  toggleGroupCollapse: (groupId: string) => void
  /** 获取知识库所属分组 */
  getBookGroup: (bookId: string) => BookGroup | null
  /** 加载状态 */
  loadState: () => void
  /** 保存状态 */
  saveState: () => void
}

export const useBookOrganizeStore = create<BookOrganizeState>((set, get) => ({
  pinnedBookIds: [],
  groups: [],

  pinBook: (bookId: string) => {
    set((state) => {
      if (state.pinnedBookIds.includes(bookId)) return state
      return { pinnedBookIds: [...state.pinnedBookIds, bookId] }
    })
    get().saveState()
  },

  unpinBook: (bookId: string) => {
    set((state) => ({
      pinnedBookIds: state.pinnedBookIds.filter(id => id !== bookId)
    }))
    get().saveState()
  },

  isPinned: (bookId: string) => {
    return get().pinnedBookIds.includes(bookId)
  },

  createGroup: (name: string) => {
    const id = `group_${Date.now()}`
    set((state) => ({
      groups: [...state.groups, { id, name, bookIds: [], collapsed: false }]
    }))
    get().saveState()
    return id
  },

  deleteGroup: (groupId: string) => {
    set((state) => ({
      groups: state.groups.filter(g => g.id !== groupId)
    }))
    get().saveState()
  },

  renameGroup: (groupId: string, name: string) => {
    set((state) => ({
      groups: state.groups.map(g => 
        g.id === groupId ? { ...g, name } : g
      )
    }))
    get().saveState()
  },

  addBookToGroup: (groupId: string, bookId: string) => {
    set((state) => {
      // 先从其他分组移除
      const groups = state.groups.map(g => ({
        ...g,
        bookIds: g.bookIds.filter(id => id !== bookId)
      }))
      // 添加到目标分组
      return {
        groups: groups.map(g =>
          g.id === groupId 
            ? { ...g, bookIds: [...g.bookIds, bookId] }
            : g
        )
      }
    })
    get().saveState()
  },

  removeBookFromGroup: (groupId: string, bookId: string) => {
    set((state) => ({
      groups: state.groups.map(g =>
        g.id === groupId
          ? { ...g, bookIds: g.bookIds.filter(id => id !== bookId) }
          : g
      )
    }))
    get().saveState()
  },

  toggleGroupCollapse: (groupId: string) => {
    set((state) => ({
      groups: state.groups.map(g =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      )
    }))
    get().saveState()
  },

  getBookGroup: (bookId: string) => {
    return get().groups.find(g => g.bookIds.includes(bookId)) || null
  },

  loadState: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { pinnedBookIds, groups } = JSON.parse(saved)
        set({ 
          pinnedBookIds: pinnedBookIds || [],
          groups: groups || []
        })
      }
    } catch (error) {
      console.error('Failed to load book organize state:', error)
    }
  },

  saveState: () => {
    try {
      const { pinnedBookIds, groups } = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pinnedBookIds, groups }))
    } catch (error) {
      console.error('Failed to save book organize state:', error)
    }
  }
}))
