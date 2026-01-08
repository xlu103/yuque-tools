/**
 * File Manager Service
 * Handles opening local files and external URLs
 * Requirements: 4.2, 4.3, 4.4, 5.2, 5.3
 */

import { shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Open a local file with the system default application
 * Requirements: 4.2, 4.3, 4.4
 * 
 * @param filePath - Path to the file to open
 * @returns Promise resolving to success status and optional error message
 */
export async function openFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `文件不存在: ${filePath}`
      }
    }

    // Open file with system default application
    const result = await shell.openPath(filePath)
    
    // shell.openPath returns empty string on success, error message on failure
    if (result) {
      return {
        success: false,
        error: result
      }
    }

    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `打开文件失败: ${errorMsg}`
    }
  }
}

/**
 * Show a file in the system file manager (Finder/Explorer)
 * Requirements: 4.2
 * 
 * @param filePath - Path to the file to show
 * @returns Promise resolving to success status and optional error message
 */
export async function showInFolder(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `文件不存在: ${filePath}`
      }
    }

    // Show file in system file manager
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `显示文件失败: ${errorMsg}`
    }
  }
}

/**
 * Build a Yuque document URL
 * Requirements: 5.3
 * 
 * @param userLogin - User login name
 * @param bookSlug - Knowledge base slug
 * @param docSlug - Document slug
 * @returns The constructed Yuque URL
 */
export function buildYuqueUrl(userLogin: string, bookSlug: string, docSlug: string): string {
  // Validate inputs
  if (!userLogin || !bookSlug || !docSlug) {
    throw new Error('userLogin, bookSlug, and docSlug are required')
  }

  // Construct URL following Yuque's URL pattern
  return `https://www.yuque.com/${userLogin}/${bookSlug}/${docSlug}`
}

/**
 * Open a URL in the default browser
 * Requirements: 5.2
 * 
 * @param url - URL to open
 * @returns Promise resolving to success status and optional error message
 */
export async function openUrl(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate URL
    if (!url) {
      return {
        success: false,
        error: 'URL 不能为空'
      }
    }

    // Open URL in default browser
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `打开链接失败: ${errorMsg}`
    }
  }
}

/**
 * Open a Yuque document in the default browser
 * Requirements: 5.2, 5.3
 * 
 * @param userLogin - User login name
 * @param bookSlug - Knowledge base slug
 * @param docSlug - Document slug
 * @returns Promise resolving to success status and optional error message
 */
export async function openInYuque(
  userLogin: string,
  bookSlug: string,
  docSlug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = buildYuqueUrl(userLogin, bookSlug, docSlug)
    return await openUrl(url)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `打开语雀链接失败: ${errorMsg}`
    }
  }
}

/**
 * Read file content
 * 
 * @param filePath - Path to the file to read
 * @returns Promise resolving to file content or error
 */
export async function readFileContent(
  filePath: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `文件不存在: ${filePath}`
      }
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `读取文件失败: ${errorMsg}`
    }
  }
}
