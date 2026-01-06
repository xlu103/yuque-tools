/**
 * Auth Service
 * Handles authentication with Yuque API
 * Adapted from yuque-tools-cli login logic
 */

import axios from 'axios'
import JSEncrypt from 'jsencrypt-node'
import { saveSession, getValidSession, clearSession, type SessionData } from '../db/stores/auth'

// Yuque API configuration (from yuque-tools-cli)
const YUQUE_CONFIG = {
  host: 'https://www.yuque.com',
  publicKey: `-----BEGIN PUBLIC KEY-----
  MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCfwyOyncSrUTmkaUPsXT6UUdXx
  TQ6a0wgPShvebfwq8XeNj575bUlXxVa/ExIn4nOUwx6iR7vJ2fvz5Ls750D051S7
  q70sevcmc8SsBNoaMQtyF/gETPBSsyWv3ccBJFrzZ5hxFdlVUfg6tXARtEI8rbIH
  su6TBkVjk+n1Pw/ihQIDAQAB
  -----END PUBLIC KEY-----`,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G81 YuqueMobileApp/1.0.2 (AppBuild/650 Device/Phone Locale/zh-cn Theme/light YuqueType/public)',
  loginApi: '/api/mobile_app/accounts/login?language=zh-cn',
  referer: '/login?goto=https%3A%2F%2Fwww.yuque.com%2Fdashboard'
}

interface LoginResponse {
  ok: boolean
  goto?: string
  me?: {
    id: string
    login: string
    name: string
    description?: string
  }
}

export interface LoginResult {
  success: boolean
  error?: string
  session?: SessionData
}

/**
 * Encrypt password using RSA public key (same as yuque-tools-cli)
 */
function encryptPassword(password: string): string | false {
  const encryptor = new JSEncrypt()
  encryptor.setPublicKey(YUQUE_CONFIG.publicKey)
  const time = Date.now()
  const symbol = time + ':' + password
  return encryptor.encrypt(symbol)
}

/**
 * Login to Yuque
 * Adapted from yuque-tools-cli loginYuque function
 */
export async function login(userName: string, password: string): Promise<LoginResult> {
  if (!userName || !password) {
    return { success: false, error: '账号信息不完整' }
  }

  const encryptedPassword = encryptPassword(password)
  if (!encryptedPassword) {
    return { success: false, error: '密码加密失败' }
  }

  const loginInfo = {
    login: userName,
    password: encryptedPassword,
    loginType: 'password'
  }

  try {
    console.log('Attempting login to:', YUQUE_CONFIG.host + YUQUE_CONFIG.loginApi)
    
    const response = await axios({
      url: YUQUE_CONFIG.host + YUQUE_CONFIG.loginApi,
      method: 'post',
      data: loginInfo,
      headers: {
        'content-type': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        'Referer': YUQUE_CONFIG.host + YUQUE_CONFIG.referer,
        'origin': YUQUE_CONFIG.host,
        'user-agent': YUQUE_CONFIG.userAgent
      }
    })

    console.log('Login response status:', response.status)
    console.log('Login response data:', JSON.stringify(response.data, null, 2))

    const data = response.data.data as LoginResponse

    if (data.ok && data.me) {
      // Extract cookies from response
      const setCookieHeader = response.headers['set-cookie']
      const cookies = setCookieHeader ? setCookieHeader.join('; ') : ''
      console.log('Cookies received:', cookies ? 'Yes' : 'No')

      // Save session to database
      const session = saveSession({
        userId: String(data.me.id),
        userName: data.me.name,
        login: data.me.login,
        cookies
      })

      return { success: true, session }
    } else {
      console.log('Login failed - data.ok:', data.ok, 'data.me:', data.me)
      return { success: false, error: '登录失败，请确认账号密码是否正确' }
    }
  } catch (error: any) {
    console.error('Login error:', error.message)
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', JSON.stringify(error.response.data, null, 2))
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: `登录失败: ${errorMessage}` }
  }
}

/**
 * Logout - clear session
 */
export function logout(): void {
  clearSession()
}

/**
 * Get current session if valid
 */
export function getCurrentSession(): SessionData | null {
  return getValidSession()
}

/**
 * Check if user is logged in with valid session
 */
export function isLoggedIn(): boolean {
  return getValidSession() !== null
}
