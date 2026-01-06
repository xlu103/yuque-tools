/**
 * Property-Based Tests for Image Processor
 * 
 * Feature: yuque-desktop-enhancements
 * Tests correctness properties for image URL extraction, filename generation, and URL replacement
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { 
  extractImageUrls, 
  isImageUrl, 
  generateUniqueFilename,
  replaceImageUrls 
} from './imageProcessor'

// Image extensions supported by the processor
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
const yuqueCdnDomains = ['cdn.nlark.com', 'cdn.yuque.com', 'gw.alipayobjects.com']

// Generate a valid standard image URL (with extension in path)
const standardImageUrlArb = fc.tuple(
  fc.constantFrom('example.com', 'images.test.com', 'cdn.test.org'),
  fc.hexaString({ minLength: 4, maxLength: 12 }),
  fc.constantFrom(...imageExtensions)
).map(([domain, path, ext]) => `https://${domain}/images/${path}${ext}`)

// Generate a Yuque CDN image URL
const yuqueCdnUrlArb = fc.tuple(
  fc.constantFrom(...yuqueCdnDomains),
  fc.hexaString({ minLength: 8, maxLength: 16 }),
  fc.constantFrom(...imageExtensions)
).map(([domain, hash, ext]) => `https://${domain}/image/${hash}${ext}`)

// Combined image URL arbitrary
const imageUrlArb = fc.oneof(standardImageUrlArb, yuqueCdnUrlArb)

// Generate alt text that doesn't contain special markdown characters
const altTextArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')),
  { minLength: 0, maxLength: 15 }
)

// Generate markdown image syntax ![alt](url)
const markdownImageArb = fc.tuple(altTextArb, imageUrlArb)
  .map(([alt, url]) => `![${alt}](${url})`)

// Generate HTML img tag <img src="url">
const htmlImgArb = imageUrlArb.map(url => `<img src="${url}">`)

// Generate some filler text
const fillerTextArb = fc.lorem({ maxCount: 5 })

describe('Image Processor Property Tests', () => {
  /**
   * Property 1: Resource URL Extraction Completeness
   * For any valid markdown content containing image URLs, the extraction function
   * SHALL return all URLs that match the supported patterns.
   * 
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Resource URL Extraction Completeness', () => {
    it('should extract all markdown image URLs from content', () => {
      fc.assert(
        fc.property(
          fc.array(markdownImageArb, { minLength: 1, maxLength: 5 }),
          fc.array(fillerTextArb, { minLength: 0, maxLength: 3 }),
          (images, fillers) => {
            // Build markdown content
            const parts: string[] = []
            for (let i = 0; i < Math.max(images.length, fillers.length); i++) {
              if (i < fillers.length) parts.push(fillers[i])
              if (i < images.length) parts.push(images[i])
            }
            const markdown = parts.join('\n\n')
            
            // Extract URLs
            const extracted = extractImageUrls(markdown)
            
            // Extract expected URLs from the generated images
            const expectedUrls = images.map(img => {
              const match = img.match(/!\[[^\]]*\]\(([^)]+)\)/)
              return match ? match[1] : null
            }).filter(Boolean) as string[]
            
            // All expected URLs should be in extracted
            for (const url of expectedUrls) {
              expect(extracted).toContain(url)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract all HTML img tag URLs from content', () => {
      fc.assert(
        fc.property(
          fc.array(htmlImgArb, { minLength: 1, maxLength: 5 }),
          fc.array(fillerTextArb, { minLength: 0, maxLength: 3 }),
          (images, fillers) => {
            // Build markdown content
            const parts: string[] = []
            for (let i = 0; i < Math.max(images.length, fillers.length); i++) {
              if (i < fillers.length) parts.push(fillers[i])
              if (i < images.length) parts.push(images[i])
            }
            const markdown = parts.join('\n\n')
            
            // Extract URLs
            const extracted = extractImageUrls(markdown)
            
            // Extract expected URLs from the generated images
            const expectedUrls = images.map(img => {
              const match = img.match(/<img[^>]+src="([^"]+)"[^>]*>/)
              return match ? match[1] : null
            }).filter(Boolean) as string[]
            
            // All expected URLs should be in extracted
            for (const url of expectedUrls) {
              expect(extracted).toContain(url)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should extract URLs from mixed markdown and HTML content', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(markdownImageArb, htmlImgArb), { minLength: 1, maxLength: 5 }),
          fc.array(fillerTextArb, { minLength: 0, maxLength: 3 }),
          (images, fillers) => {
            // Build markdown content
            const parts: string[] = []
            for (let i = 0; i < Math.max(images.length, fillers.length); i++) {
              if (i < fillers.length) parts.push(fillers[i])
              if (i < images.length) parts.push(images[i])
            }
            const markdown = parts.join('\n\n')
            
            // Extract URLs
            const extracted = extractImageUrls(markdown)
            
            // Verify that extracted URLs are valid image URLs
            for (const url of extracted) {
              expect(isImageUrl(url)).toBe(true)
            }
            
            // Verify no duplicates
            const uniqueUrls = new Set(extracted)
            expect(extracted.length).toBe(uniqueUrls.size)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return empty array for content without images', () => {
      fc.assert(
        fc.property(
          fc.array(fillerTextArb, { minLength: 1, maxLength: 5 }),
          (fillers) => {
            const markdown = fillers.join('\n\n')
            const extracted = extractImageUrls(markdown)
            expect(extracted.length).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


  /**
   * Property 3: Unique Filename Generation
   * For any set of resource URLs processed for a single document, 
   * the generated local filenames SHALL be unique (no collisions).
   * 
   * **Validates: Requirements 1.6**
   */
  describe('Property 3: Unique Filename Generation', () => {
    it('should generate unique filenames for different URLs', () => {
      fc.assert(
        fc.property(
          fc.array(imageUrlArb, { minLength: 2, maxLength: 20 }),
          (urls) => {
            const existingFiles = new Set<string>()
            const generatedFilenames: string[] = []
            
            for (const url of urls) {
              const filename = generateUniqueFilename(url, existingFiles)
              generatedFilenames.push(filename)
              existingFiles.add(filename)
            }
            
            // All generated filenames should be unique
            const uniqueFilenames = new Set(generatedFilenames)
            expect(generatedFilenames.length).toBe(uniqueFilenames.size)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle conflicts by appending counter', () => {
      fc.assert(
        fc.property(
          imageUrlArb,
          fc.integer({ min: 1, max: 10 }),
          (url, conflictCount) => {
            const existingFiles = new Set<string>()
            const generatedFilenames: string[] = []
            
            // Generate the same URL multiple times (simulating conflicts)
            for (let i = 0; i < conflictCount; i++) {
              const filename = generateUniqueFilename(url, existingFiles)
              generatedFilenames.push(filename)
              existingFiles.add(filename)
            }
            
            // All generated filenames should be unique even for same URL
            const uniqueFilenames = new Set(generatedFilenames)
            expect(generatedFilenames.length).toBe(uniqueFilenames.size)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve image extension in generated filename', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom('example.com', 'cdn.test.org'),
            fc.hexaString({ minLength: 4, maxLength: 12 }),
            fc.constantFrom(...imageExtensions)
          ).map(([domain, path, ext]) => ({ url: `https://${domain}/images/${path}${ext}`, ext })),
          ({ url, ext }) => {
            const filename = generateUniqueFilename(url, new Set())
            expect(filename.endsWith(ext)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate valid filenames (no special characters)', () => {
      fc.assert(
        fc.property(
          imageUrlArb,
          (url) => {
            const filename = generateUniqueFilename(url, new Set())
            // Filename should only contain alphanumeric, underscore, dash, and dot
            expect(filename).toMatch(/^[a-zA-Z0-9_.-]+$/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  /**
   * Property 2: URL Replacement Consistency
   * For any markdown content processed for images, if a resource is successfully downloaded,
   * the original URL SHALL be replaced with a valid relative local path, 
   * and the resulting markdown SHALL be valid.
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: URL Replacement Consistency', () => {
    // Generate a local path
    const localPathArb = fc.tuple(
      fc.hexaString({ minLength: 4, maxLength: 12 }),
      fc.constantFrom(...imageExtensions)
    ).map(([hash, ext]) => `assets/${hash}${ext}`)

    it('should replace all occurrences of URL in markdown images', () => {
      fc.assert(
        fc.property(
          imageUrlArb,
          localPathArb,
          altTextArb,
          (url, localPath, alt) => {
            const markdown = `![${alt}](${url})`
            const urlMap = new Map([[url, localPath]])
            
            const result = replaceImageUrls(markdown, urlMap)
            
            // Original URL should not be present
            expect(result).not.toContain(url)
            // Local path should be present
            expect(result).toContain(localPath)
            // Result should be valid markdown image syntax
            expect(result).toMatch(/!\[[^\]]*\]\([^)]+\)/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should replace all occurrences of URL in HTML img tags', () => {
      fc.assert(
        fc.property(
          imageUrlArb,
          localPathArb,
          (url, localPath) => {
            const markdown = `<img src="${url}">`
            const urlMap = new Map([[url, localPath]])
            
            const result = replaceImageUrls(markdown, urlMap)
            
            // Original URL should not be present
            expect(result).not.toContain(url)
            // Local path should be present
            expect(result).toContain(localPath)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should replace multiple different URLs correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(imageUrlArb, localPathArb, altTextArb),
            { minLength: 2, maxLength: 5 }
          ).filter(arr => {
            // Ensure all URLs are unique
            const urls = arr.map(([url]) => url)
            return new Set(urls).size === urls.length
          }),
          (urlPairs) => {
            // Build markdown with multiple images
            const markdown = urlPairs
              .map(([url, _, alt]) => `![${alt}](${url})`)
              .join('\n\n')
            
            // Build URL map
            const urlMap = new Map(urlPairs.map(([url, localPath]) => [url, localPath]))
            
            const result = replaceImageUrls(markdown, urlMap)
            
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
          imageUrlArb,
          imageUrlArb,
          localPathArb,
          altTextArb,
          (urlToReplace, urlToKeep, localPath, alt) => {
            // Skip if URLs are the same
            fc.pre(urlToReplace !== urlToKeep)
            
            const markdown = `![${alt}](${urlToReplace})\n\n![other](${urlToKeep})`
            const urlMap = new Map([[urlToReplace, localPath]])
            
            const result = replaceImageUrls(markdown, urlMap)
            
            // URL to replace should be gone
            expect(result).not.toContain(urlToReplace)
            // URL to keep should still be present
            expect(result).toContain(urlToKeep)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle empty URL map (no replacements)', () => {
      fc.assert(
        fc.property(
          fc.array(markdownImageArb, { minLength: 1, maxLength: 5 }),
          (images) => {
            const markdown = images.join('\n\n')
            const urlMap = new Map<string, string>()
            
            const result = replaceImageUrls(markdown, urlMap)
            
            // Content should be unchanged
            expect(result).toBe(markdown)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
