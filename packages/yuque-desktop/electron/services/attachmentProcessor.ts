/**
 * Attachment Processor Service
 * Handles attachment extraction, download, and URL replacement in markdown
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { getValidSession } from '../db/stores/auth'
import { createResource, getResourceByUrl } from '../db/stores/resources'

// Yuque attachment domains
const YUQUE_ATTACHMENT_DOMAINS = [
  'cdn.nlark.com',
  'www.yuque.com',
  'yuque.com'
]

// Attachment URL patterns in path
const ATTACHMENT_PATH_PATTERNS = [
  '/attachments/',
  '/attachment/',
  '/yuque/__puml/',
  '/office/'
]

/**
 * Information about an extracted attachment
 */
export interface AttachmentInfo {
  url: string
  filename: string
  displayText: string
}

/**
 * Extract all attachment URLs from markdown content
 * Supports:
 * - Markdown links: [filename](url) with Yuque attachment domains
 * - Direct Yuque attachment URLs
 * 
 * Requirements: 2.1
 */
export function extractAttachmentUrls(markdown: string): AttachmentInfo[] {
  const attachments: Map<string, AttachmentInfo> = new Map()
  
  // Pattern 1: Markdown links [text](url)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = mdLinkRegex.exec(markdown)) !== null) {
    const displayText = match[1].trim()
    const url = match[2].trim()
    
    if (isAttachmentUrl(url)) {
      const filename = extractFilenameFromUrl(url) || extractFilenameFromDisplayText(displayText)
      if (!attachments.has(url)) {
        attachments.set(url, {
          url,
          filename,
          displayText
        })
      }
    }
  }
  
  return Array.from(attachments.values())
}

/**
 * Check if a URL is an attachment URL (not an image)
 */
export function isAttachmentUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) {
    return false
  }
  
  try {
    const urlObj = new URL(url)
    
    // Check if it's from a Yuque domain
    const isYuqueDomain = YUQUE_ATTACHMENT_DOMAINS.some(domain => 
      urlObj.hostname.includes(domain)
    )
    
    if (!isYuqueDomain) {
      return false
    }
    
    const pathname = urlObj.pathname.toLowerCase()
    
    // Check if it matches attachment path patterns
    const isAttachmentPath = ATTACHMENT_PATH_PATTERNS.some(pattern => 
      pathname.includes(pattern)
    )
    
    if (isAttachmentPath) {
      // Make sure it's not an image
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
      const isImage = imageExtensions.some(ext => pathname.endsWith(ext))
      return !isImage
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Extract filename from URL
 * Tries to get the original filename from URL path or query parameters
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // Try to get filename from path
    const pathParts = pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    
    if (lastPart && lastPart.includes('.')) {
      // Decode URL-encoded characters
      return decodeURIComponent(lastPart)
    }
    
    // Try to get filename from query parameter (some Yuque URLs have this)
    const filenameParam = urlObj.searchParams.get('filename') || 
                          urlObj.searchParams.get('name')
    if (filenameParam) {
      return decodeURIComponent(filenameParam)
    }
    
    return ''
  } catch {
    return ''
  }
}

/**
 * Extract filename from display text
 * Used as fallback when URL doesn't contain filename
 */
export function extractFilenameFromDisplayText(displayText: string): string {
  // If display text looks like a filename (has extension), use it
  if (displayText && /\.[a-zA-Z0-9]{1,10}$/.test(displayText)) {
    return displayText
  }
  return displayText || 'attachment'
}


/**
 * Generate a unique filename for an attachment
 * Preserves the original filename but handles conflicts
 * 
 * Requirements: 2.5, 2.6
 */
export function generateUniqueAttachmentFilename(
  originalFilename: string, 
  existingFiles: Set<string>
): string {
  if (!existingFiles.has(originalFilename)) {
    return originalFilename
  }
  
  // Handle conflict by appending number suffix
  const lastDotIndex = originalFilename.lastIndexOf('.')
  let baseName: string
  let extension: string
  
  if (lastDotIndex > 0) {
    baseName = originalFilename.substring(0, lastDotIndex)
    extension = originalFilename.substring(lastDotIndex)
  } else {
    baseName = originalFilename
    extension = ''
  }
  
  let counter = 1
  let newFilename = `${baseName}_${counter}${extension}`
  
  while (existingFiles.has(newFilename)) {
    counter++
    newFilename = `${baseName}_${counter}${extension}`
  }
  
  return newFilename
}

/**
 * Check if URL is from Yuque domain
 */
function isYuqueUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return YUQUE_ATTACHMENT_DOMAINS.some(domain => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}

/**
 * Download an attachment from URL
 * Returns the local file path and size or null if failed
 * 
 * Requirements: 2.2
 */
export async function downloadAttachment(
  url: string,
  targetDir: string,
  filename: string
): Promise<{ localPath: string; sizeBytes: number } | null> {
  try {
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    
    const localPath = path.join(targetDir, filename)
    
    // Get session for authenticated requests
    const session = getValidSession()
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    if (session && isYuqueUrl(url)) {
      headers['Cookie'] = session.cookies
    }
    
    // Download attachment
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers,
      timeout: 60000, // 60 seconds for larger files
      maxContentLength: 100 * 1024 * 1024 // 100MB max
    })
    
    // Write to file
    fs.writeFileSync(localPath, response.data)
    
    const sizeBytes = response.data.length
    
    return { localPath, sizeBytes }
  } catch (error) {
    console.error(`Failed to download attachment ${url}:`, error)
    return null
  }
}

/**
 * Replace attachment URLs in markdown with local paths
 * 
 * Requirements: 2.3
 */
export function replaceAttachmentUrls(
  markdown: string,
  urlToLocalPath: Map<string, string>
): string {
  let result = markdown
  
  for (const [remoteUrl, localPath] of urlToLocalPath) {
    // Escape special regex characters in URL
    const escapedUrl = remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    // Replace in markdown link syntax [text](url)
    const mdRegex = new RegExp(`(\\[[^\\]]+\\]\\()${escapedUrl}(\\))`, 'g')
    result = result.replace(mdRegex, `$1${localPath}$2`)
  }
  
  return result
}

/**
 * Process all attachments in a document
 * Downloads attachments and replaces URLs with local paths
 * Returns the modified markdown content
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export async function processDocumentAttachments(
  markdown: string,
  docId: string,
  docDir: string,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  // Extract all attachment URLs
  const attachments = extractAttachmentUrls(markdown)
  
  if (attachments.length === 0) {
    return markdown
  }
  
  console.log(`[AttachmentProcessor] Found ${attachments.length} attachments in document`)
  
  // Create attachments directory
  const attachmentsDir = path.join(docDir, 'attachments')
  
  // Track existing files to avoid conflicts
  const existingFiles = new Set<string>()
  if (fs.existsSync(attachmentsDir)) {
    fs.readdirSync(attachmentsDir).forEach(f => existingFiles.add(f))
  }
  
  // Download attachments and build URL mapping
  const urlToLocalPath = new Map<string, string>()
  
  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i]
    
    if (onProgress) {
      onProgress(i + 1, attachments.length)
    }
    
    // Check if already downloaded
    const existingResource = getResourceByUrl(attachment.url)
    if (existingResource && existingResource.status === 'downloaded' && existingResource.local_path) {
      // Use existing local path
      const relativePath = path.relative(docDir, existingResource.local_path)
      urlToLocalPath.set(attachment.url, relativePath)
      continue
    }
    
    // Generate unique filename (preserving original name)
    const filename = generateUniqueAttachmentFilename(attachment.filename, existingFiles)
    existingFiles.add(filename)
    
    // Download attachment
    const result = await downloadAttachment(attachment.url, attachmentsDir, filename)
    
    if (result) {
      // Record in database
      createResource({
        docId,
        type: 'attachment',
        remoteUrl: attachment.url,
        localPath: result.localPath,
        filename,
        sizeBytes: result.sizeBytes,
        status: 'downloaded'
      })
      
      // Add to URL mapping (use relative path)
      const relativePath = `attachments/${filename}`
      urlToLocalPath.set(attachment.url, relativePath)
      
      console.log(`[AttachmentProcessor] Downloaded: ${filename}`)
    } else {
      // Record failure
      createResource({
        docId,
        type: 'attachment',
        remoteUrl: attachment.url,
        filename: attachment.filename,
        status: 'failed'
      })
      
      console.log(`[AttachmentProcessor] Failed to download: ${attachment.url}`)
    }
  }
  
  // Replace URLs in markdown
  if (urlToLocalPath.size > 0) {
    return replaceAttachmentUrls(markdown, urlToLocalPath)
  }
  
  return markdown
}
