/**
 * Image Processor Service
 * Handles image extraction, download, and URL replacement in markdown
 */

import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { getValidSession } from '../db/stores/auth'
import { createResource, getResourceByUrl } from '../db/stores/resources'

// Yuque CDN domains
const YUQUE_CDN_DOMAINS = [
  'cdn.nlark.com',
  'cdn.yuque.com',
  'gw.alipayobjects.com',
  'intranetproxy.alipay.com'
]

// Supported image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']

/**
 * Extract all image URLs from markdown content
 * Supports:
 * - Standard markdown: ![alt](url)
 * - HTML img tags: <img src="url">
 * - Yuque CDN links
 */
export function extractImageUrls(markdown: string): string[] {
  const urls: Set<string> = new Set()
  
  // Pattern 1: Standard markdown images ![alt](url)
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match
  while ((match = mdImageRegex.exec(markdown)) !== null) {
    const url = match[2].trim()
    if (isImageUrl(url)) {
      urls.add(url)
    }
  }
  
  // Pattern 2: HTML img tags <img src="url">
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((match = htmlImgRegex.exec(markdown)) !== null) {
    const url = match[1].trim()
    if (isImageUrl(url)) {
      urls.add(url)
    }
  }
  
  // Pattern 3: Yuque specific image links (may appear as plain URLs)
  const yuqueUrlRegex = /https?:\/\/(?:cdn\.nlark\.com|cdn\.yuque\.com|gw\.alipayobjects\.com)[^\s"'<>)]+/gi
  while ((match = yuqueUrlRegex.exec(markdown)) !== null) {
    const url = match[0].trim()
    if (isImageUrl(url)) {
      urls.add(url)
    }
  }
  
  return Array.from(urls)
}

/**
 * Check if a URL is an image URL
 */
export function isImageUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) {
    return false
  }
  
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    
    // Check by extension
    if (IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
      return true
    }
    
    // Check by Yuque CDN domain (they often don't have extensions)
    if (YUQUE_CDN_DOMAINS.some(domain => urlObj.hostname.includes(domain))) {
      // Yuque CDN images often have these patterns
      if (pathname.includes('/image/') || 
          pathname.includes('/png/') || 
          pathname.includes('/jpeg/') ||
          urlObj.searchParams.has('x-oss-process')) {
        return true
      }
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Generate a unique filename for an image
 * Uses URL hash + original extension
 */
export function generateUniqueFilename(url: string, existingFiles: Set<string>): string {
  const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12)
  let extension = '.png' // default
  
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    
    // Try to get extension from URL
    for (const ext of IMAGE_EXTENSIONS) {
      if (pathname.includes(ext)) {
        extension = ext
        break
      }
    }
  } catch {
    // Use default extension
  }
  
  let filename = `${hash}${extension}`
  let counter = 1
  
  // Handle conflicts
  while (existingFiles.has(filename)) {
    filename = `${hash}_${counter}${extension}`
    counter++
  }
  
  return filename
}

/**
 * Download an image from URL
 * Returns the local file path or null if failed
 */
export async function downloadImage(
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
    
    // Download image
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers,
      timeout: 30000
    })
    
    // Write to file
    fs.writeFileSync(localPath, response.data)
    
    const sizeBytes = response.data.length
    
    return { localPath, sizeBytes }
  } catch (error) {
    console.error(`Failed to download image ${url}:`, error)
    return null
  }
}

/**
 * Check if URL is from Yuque domain
 */
function isYuqueUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return YUQUE_CDN_DOMAINS.some(domain => urlObj.hostname.includes(domain)) ||
           urlObj.hostname.includes('yuque.com')
  } catch {
    return false
  }
}

/**
 * Replace image URLs in markdown with local paths
 */
export function replaceImageUrls(
  markdown: string, 
  urlToLocalPath: Map<string, string>
): string {
  let result = markdown
  
  for (const [remoteUrl, localPath] of urlToLocalPath) {
    // Escape special regex characters in URL
    const escapedUrl = remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    // Replace in markdown image syntax
    const mdRegex = new RegExp(`(!\\[[^\\]]*\\]\\()${escapedUrl}(\\))`, 'g')
    result = result.replace(mdRegex, `$1${localPath}$2`)
    
    // Replace in HTML img tags
    const htmlRegex = new RegExp(`(<img[^>]+src=["'])${escapedUrl}(["'][^>]*>)`, 'gi')
    result = result.replace(htmlRegex, `$1${localPath}$2`)
    
    // Replace plain URLs (for Yuque specific cases)
    result = result.split(remoteUrl).join(localPath)
  }
  
  return result
}

/**
 * Process all images in a document
 * Downloads images and replaces URLs with local paths
 * Returns the modified markdown content
 */
export async function processDocumentImages(
  markdown: string,
  docId: string,
  docDir: string,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  // Extract all image URLs
  const imageUrls = extractImageUrls(markdown)
  
  if (imageUrls.length === 0) {
    return markdown
  }
  
  console.log(`[ImageProcessor] Found ${imageUrls.length} images in document`)
  
  // Create assets directory
  const assetsDir = path.join(docDir, 'assets')
  
  // Track existing files to avoid conflicts
  const existingFiles = new Set<string>()
  if (fs.existsSync(assetsDir)) {
    fs.readdirSync(assetsDir).forEach(f => existingFiles.add(f))
  }
  
  // Download images and build URL mapping
  const urlToLocalPath = new Map<string, string>()
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]
    
    if (onProgress) {
      onProgress(i + 1, imageUrls.length)
    }
    
    // Check if already downloaded
    const existingResource = getResourceByUrl(url)
    if (existingResource && existingResource.status === 'downloaded' && existingResource.local_path) {
      // Check if the file still exists
      if (fs.existsSync(existingResource.local_path)) {
        // Use existing local path - calculate relative path and normalize to forward slashes
        const relativePath = path.relative(docDir, existingResource.local_path).split(path.sep).join('/')
        urlToLocalPath.set(url, relativePath)
        continue
      }
      // File doesn't exist anymore, will re-download below
    }
    
    // Generate unique filename
    const filename = generateUniqueFilename(url, existingFiles)
    existingFiles.add(filename)
    
    // Download image
    const result = await downloadImage(url, assetsDir, filename)
    
    if (result) {
      // Record in database
      createResource({
        docId,
        type: 'image',
        remoteUrl: url,
        localPath: result.localPath,
        filename,
        sizeBytes: result.sizeBytes,
        status: 'downloaded'
      })
      
      // Add to URL mapping (use relative path)
      const relativePath = `assets/${filename}`
      urlToLocalPath.set(url, relativePath)
      
      console.log(`[ImageProcessor] Downloaded: ${filename}`)
    } else {
      // Record failure
      createResource({
        docId,
        type: 'image',
        remoteUrl: url,
        status: 'failed'
      })
      
      console.log(`[ImageProcessor] Failed to download: ${url}`)
    }
  }
  
  // Replace URLs in markdown
  if (urlToLocalPath.size > 0) {
    return replaceImageUrls(markdown, urlToLocalPath)
  }
  
  return markdown
}
