import { create } from 'zustand'
import type { Session } from '../hooks'

interface AuthState {
  session: Session | null
  isLoading: boolean
  isInitialized: boolean
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  isInitialized: false,
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  logout: () => set({ session: null })
}))
