/**
 * Auth Store
 * Session management with persistence and expiry checking
 */

import { getDatabase } from '../index'

// Session expiry time: 24 hours in milliseconds
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000

export interface SessionRecord {
  user_id: string
  user_name: string
  login: string
  cookies: string
  expires_at: number
  created_at: string
  updated_at: string
}

export interface SessionData {
  userId: string
  userName: string
  login: string
  cookies: string
  expiresAt: number
}

/**
 * Save session to database
 */
export function saveSession(session: Omit<SessionData, 'expiresAt'>): SessionData {
  const db = getDatabase()
  const expiresAt = Date.now() + SESSION_EXPIRY_MS
  
  // Clear any existing session first
  db.prepare('DELETE FROM auth_session').run()
  
  // Insert new session
  db.prepare(`
    INSERT INTO auth_session (user_id, user_name, login, cookies, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(session.userId, session.userName, session.login, session.cookies, expiresAt)
  
  return {
    ...session,
    expiresAt
  }
}

/**
 * Get current session from database
 */
export function getSession(): SessionData | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM auth_session LIMIT 1').get() as SessionRecord | undefined
  
  if (!row) {
    return null
  }
  
  return {
    userId: row.user_id,
    userName: row.user_name,
    login: row.login,
    cookies: row.cookies,
    expiresAt: row.expires_at
  }
}

/**
 * Check if session is valid (exists and not expired)
 */
export function isSessionValid(): boolean {
  const session = getSession()
  if (!session) {
    return false
  }
  return Date.now() < session.expiresAt
}

/**
 * Get valid session (returns null if expired)
 */
export function getValidSession(): SessionData | null {
  const session = getSession()
  if (!session) {
    return null
  }
  
  if (Date.now() >= session.expiresAt) {
    // Session expired, clear it
    clearSession()
    return null
  }
  
  return session
}

/**
 * Clear session (logout)
 */
export function clearSession(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM auth_session').run()
}

/**
 * Get session cookies for API requests
 */
export function getSessionCookies(): string | null {
  const session = getValidSession()
  return session?.cookies ?? null
}

/**
 * Refresh session expiry time
 */
export function refreshSessionExpiry(): void {
  const db = getDatabase()
  const newExpiresAt = Date.now() + SESSION_EXPIRY_MS
  
  db.prepare(`
    UPDATE auth_session 
    SET expires_at = ?, updated_at = datetime('now')
  `).run(newExpiresAt)
}
