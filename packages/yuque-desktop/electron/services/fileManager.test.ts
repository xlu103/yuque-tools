/**
 * Property-Based Tests for File Manager
 * 
 * Feature: yuque-desktop-enhancements
 * Tests correctness properties for Yuque URL construction
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { buildYuqueUrl } from './fileManager'

// Generate valid userLogin (alphanumeric, lowercase, may contain hyphens)
const userLoginArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 20 }
).filter(s => !s.startsWith('-') && !s.endsWith('-') && s.length > 0)

// Generate valid bookSlug (alphanumeric, lowercase, may contain hyphens)
const bookSlugArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 30 }
).filter(s => !s.startsWith('-') && !s.endsWith('-') && s.length > 0)

// Generate valid docSlug (alphanumeric, lowercase, may contain hyphens and underscores)
const docSlugArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 50 }
).filter(s => !s.startsWith('-') && !s.endsWith('-') && s.length > 0)

describe('File Manager Property Tests', () => {
  /**
   * Property 6: Yuque URL Construction
   * For any valid combination of userLogin, bookSlug, and docSlug, 
   * the constructed Yuque URL SHALL follow the format 
   * `https://www.yuque.com/{userLogin}/{bookSlug}/{docSlug}`.
   * 
   * **Validates: Requirements 5.3**
   */
  describe('Property 6: Yuque URL Construction', () => {
    it('should construct URL in correct format for any valid inputs', () => {
      fc.assert(
        fc.property(
          userLoginArb,
          bookSlugArb,
          docSlugArb,
          (userLogin, bookSlug, docSlug) => {
            const url = buildYuqueUrl(userLogin, bookSlug, docSlug)
            
            // URL should follow the exact format
            const expectedUrl = `https://www.yuque.com/${userLogin}/${bookSlug}/${docSlug}`
            expect(url).toBe(expectedUrl)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should always start with https://www.yuque.com/', () => {
      fc.assert(
        fc.property(
          userLoginArb,
          bookSlugArb,
          docSlugArb,
          (userLogin, bookSlug, docSlug) => {
            const url = buildYuqueUrl(userLogin, bookSlug, docSlug)
            expect(url.startsWith('https://www.yuque.com/')).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should contain all three path segments in correct order', () => {
      fc.assert(
        fc.property(
          userLoginArb,
          bookSlugArb,
          docSlugArb,
          (userLogin, bookSlug, docSlug) => {
            const url = buildYuqueUrl(userLogin, bookSlug, docSlug)
            
            // Parse the URL and check path segments
            const urlObj = new URL(url)
            const pathSegments = urlObj.pathname.split('/').filter(Boolean)
            
            expect(pathSegments.length).toBe(3)
            expect(pathSegments[0]).toBe(userLogin)
            expect(pathSegments[1]).toBe(bookSlug)
            expect(pathSegments[2]).toBe(docSlug)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should produce a valid URL that can be parsed', () => {
      fc.assert(
        fc.property(
          userLoginArb,
          bookSlugArb,
          docSlugArb,
          (userLogin, bookSlug, docSlug) => {
            const url = buildYuqueUrl(userLogin, bookSlug, docSlug)
            
            // Should not throw when parsing
            expect(() => new URL(url)).not.toThrow()
            
            // Should have correct protocol and host
            const urlObj = new URL(url)
            expect(urlObj.protocol).toBe('https:')
            expect(urlObj.host).toBe('www.yuque.com')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should be deterministic - same inputs produce same output', () => {
      fc.assert(
        fc.property(
          userLoginArb,
          bookSlugArb,
          docSlugArb,
          (userLogin, bookSlug, docSlug) => {
            const url1 = buildYuqueUrl(userLogin, bookSlug, docSlug)
            const url2 = buildYuqueUrl(userLogin, bookSlug, docSlug)
            
            expect(url1).toBe(url2)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
