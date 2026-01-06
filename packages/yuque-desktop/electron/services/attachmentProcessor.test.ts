/**
 * Property-Based Tests for Attachment Processor
 * 
 * Feature: yuque-desktop-enhancements
 * Tests correctness properties for attachment URL extraction, filename preservation, and URL replacement
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  extractAttachmentUrls,
  isAttachmentUrl,
  extractFilenameFromUrl,
  extractFilenameFromDisplayText,
  generateUniqueAttachmentFilename,
  replaceAttachmentUrls
} from './attachmentProcessor'

// Common file extensions for attachments
const attachmentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.txt', '.csv']

// Yuque attachment domains
const yuqueAttachmentDomains = ['cdn.nlark.com', 'www.yuque.com']

// Generate a valid filename with extension
const filenameArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), { minLength: 1, maxLength: 20 }),
  fc.constantFrom(...attachmentExtensions)
).map(([name, ext]) => `${name}${ext}`)

// Generate a Yuque attachment URL
const yuqueAttachmentUrlArb = fc.tuple(
  fc.constantFrom(...yuqueAttachmentDomains),
  fc.hexaString({ minLength: 8, maxLength: 16 }),
  filenameArb
).map(([domain, hash, filename]) => `https://${domain}/attachments/${hash}/${encodeURIComponent(filename)}`)

// Generate markdown link syntax [text](url)
const markdownAttachmentLinkArb = fc.tuple(
  filenameArb,
  yuqueAttachmentUrlArb
).map(([displayText, url]) => ({ markdown: `[${displayText}](${url})`, displayText, url }))

// Generate some filler text
const fillerTextArb = fc.lorem({ maxCount: 5 })

describe('Attachment Processor Property Tests', () => {
  /**
   * Property 4: Attachment Filename Preservation
   * For any attachment download, the saved filename SHALL contain the original filename from the URL or link text.
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 4: Attachment Filename Preservation', () => {
    it('should preserve original filename from URL when no conflicts', () => {
      fc.assert(
        fc.property(
          filenameArb,
          (originalFilename) => {
            const existingFiles = new Set<string>()
            const result = generateUniqueAttachmentFilename(originalFilename, existingFiles)
            
            // Result should be exactly the original filename when no conflicts
            expect(result).toBe(originalFilename)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve original filename base and extension when handling conflicts', () => {
      fc.assert(
        fc.property(
          filenameArb,
          fc.integer({ min: 1, max: 10 }),
          (originalFilename, conflictCount) => {
            const existingFiles = new Set<string>()
            const generatedFilenames: string[] = []
            
            // Generate the same filename multiple times (simulating conflicts)
            for (let i = 0; i < conflictCount; i++) {
              const filename = generateUniqueAttachmentFilename(originalFilename, existingFiles)
              generatedFilenames.push(filename)
              existingFiles.add(filename)
            }
            
            // Extract extension from original
            const lastDotIndex = originalFilename.lastIndexOf('.')
            const originalExtension = lastDotIndex > 0 ? originalFilename.substring(lastDotIndex) : ''
            const originalBaseName = lastDotIndex > 0 ? originalFilename.substring(0, lastDotIndex) : originalFilename
            
            // All generated filenames should:
            // 1. Be unique
            const uniqueFilenames = new Set(generatedFilenames)
            expect(generatedFilenames.length).toBe(uniqueFilenames.size)
            
            // 2. Preserve the original extension
            for (const filename of generatedFilenames) {
              if (originalExtension) {
                expect(filename.endsWith(originalExtension)).toBe(true)
              }
            }
            
            // 3. Contain the original base name
            for (const filename of generatedFilenames) {
              expect(filename.startsWith(originalBaseName)).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract filename from URL path correctly', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom(...yuqueAttachmentDomains),
            fc.hexaString({ minLength: 8, maxLength: 16 }),
            filenameArb
          ),
          ([domain, hash, expectedFilename]) => {
            const url = `https://${domain}/attachments/${hash}/${encodeURIComponent(expectedFilename)}`
            const extractedFilename = extractFilenameFromUrl(url)
            
            // Extracted filename should match the original
            expect(extractedFilename).toBe(expectedFilename)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use display text as filename when URL has no filename', () => {
      fc.assert(
        fc.property(
          filenameArb,
          (displayText) => {
            const result = extractFilenameFromDisplayText(displayText)
            
            // If display text looks like a filename, it should be returned
            expect(result).toBe(displayText)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract attachments from markdown and preserve filenames in info', () => {
      fc.assert(
        fc.property(
          fc.array(markdownAttachmentLinkArb, { minLength: 1, maxLength: 5 }),
          fc.array(fillerTextArb, { minLength: 0, maxLength: 3 }),
          (attachmentLinks, fillers) => {
            // Build markdown content
            const parts: string[] = []
            for (let i = 0; i < Math.max(attachmentLinks.length, fillers.length); i++) {
              if (i < fillers.length) parts.push(fillers[i])
              if (i < attachmentLinks.length) parts.push(attachmentLinks[i].markdown)
            }
            const markdown = parts.join('\n\n')
            
            // Extract attachments
            const extracted = extractAttachmentUrls(markdown)
            
            // Each extracted attachment should have a filename
            for (const attachment of extracted) {
              expect(attachment.filename).toBeTruthy()
              expect(attachment.filename.length).toBeGreaterThan(0)
              
              // Filename should have an extension
              expect(attachment.filename).toMatch(/\.[a-zA-Z0-9]+$/)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional tests for attachment URL extraction
   */
  describe('Attachment URL Extraction', () => {
    it('should extract all attachment URLs from markdown content', () => {
      fc.assert(
        fc.property(
          fc.array(markdownAttachmentLinkArb, { minLength: 1, maxLength: 5 }),
          fc.array(fillerTextArb, { minLength: 0, maxLength: 3 }),
          (attachmentLinks, fillers) => {
            // Build markdown content
            const parts: string[] = []
            for (let i = 0; i < Math.max(attachmentLinks.length, fillers.length); i++) {
              if (i < fillers.length) parts.push(fillers[i])
              if (i < attachmentLinks.length) parts.push(attachmentLinks[i].markdown)
            }
            const markdown = parts.join('\n\n')
            
            // Extract attachments
            const extracted = extractAttachmentUrls(markdown)
            
            // All expected URLs should be extracted
            const expectedUrls = attachmentLinks.map(a => a.url)
            for (const url of expectedUrls) {
              const found = extracted.some(a => a.url === url)
              expect(found).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return empty array for content without attachments', () => {
      fc.assert(
        fc.property(
          fc.array(fillerTextArb, { minLength: 1, maxLength: 5 }),
          (fillers) => {
            const markdown = fillers.join('\n\n')
            const extracted = extractAttachmentUrls(markdown)
            expect(extracted.length).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not extract image URLs as attachments', () => {
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
      
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom(...yuqueAttachmentDomains),
            fc.hexaString({ minLength: 8, maxLength: 16 }),
            fc.constantFrom(...imageExtensions)
          ),
          ([domain, hash, ext]) => {
            const imageUrl = `https://${domain}/attachments/${hash}/image${ext}`
            const markdown = `[image](${imageUrl})`
            
            const extracted = extractAttachmentUrls(markdown)
            
            // Should not extract image URLs
            expect(extracted.length).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Tests for URL replacement
   */
  describe('Attachment URL Replacement', () => {
    it('should replace all occurrences of attachment URL in markdown', () => {
      fc.assert(
        fc.property(
          yuqueAttachmentUrlArb,
          filenameArb,
          filenameArb,
          (url, displayText, localFilename) => {
            const markdown = `[${displayText}](${url})`
            const localPath = `attachments/${localFilename}`
            const urlMap = new Map([[url, localPath]])
            
            const result = replaceAttachmentUrls(markdown, urlMap)
            
            // Original URL should not be present
            expect(result).not.toContain(url)
            // Local path should be present
            expect(result).toContain(localPath)
            // Display text should be preserved
            expect(result).toContain(`[${displayText}]`)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should replace multiple different attachment URLs correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(yuqueAttachmentUrlArb, filenameArb, filenameArb),
            { minLength: 2, maxLength: 5 }
          ).filter(arr => {
            // Ensure all URLs are unique
            const urls = arr.map(([url]) => url)
            return new Set(urls).size === urls.length
          }),
          (urlPairs) => {
            // Build markdown with multiple attachments
            const markdown = urlPairs
              .map(([url, displayText]) => `[${displayText}](${url})`)
              .join('\n\n')
            
            // Build URL map
            const urlMap = new Map(
              urlPairs.map(([url, _, localFilename]) => [url, `attachments/${localFilename}`])
            )
            
            const result = replaceAttachmentUrls(markdown, urlMap)
            
            // All original URLs should be replaced
            for (const [url, localPath] of urlMap) {
              expect(result).not.toContain(url)
              expect(result).toContain(localPath)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not modify URLs not in the replacement map', () => {
      fc.assert(
        fc.property(
          yuqueAttachmentUrlArb,
          yuqueAttachmentUrlArb,
          filenameArb,
          filenameArb,
          (urlToReplace, urlToKeep, displayText, localFilename) => {
            // Skip if URLs are the same
            fc.pre(urlToReplace !== urlToKeep)
            
            const markdown = `[file1](${urlToReplace})\n\n[file2](${urlToKeep})`
            const urlMap = new Map([[urlToReplace, `attachments/${localFilename}`]])
            
            const result = replaceAttachmentUrls(markdown, urlMap)
            
            // URL to replace should be gone
            expect(result).not.toContain(urlToReplace)
            // URL to keep should still be present
            expect(result).toContain(urlToKeep)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
