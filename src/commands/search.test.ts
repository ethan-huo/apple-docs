import { describe, expect, test } from 'bun:test'
import * as cheerio from 'cheerio'
import { extractResultType, parseResult } from './search'

function makeElement(html: string) {
  const $ = cheerio.load(html, null, false)
  return $($.root().children().first())
}

describe('extractResultType', () => {
  test('extracts sample_code from class list', () => {
    const el = makeElement('<div class="search-result sample_code"></div>')
    expect(extractResultType(el)).toBe('sample_code')
  })

  test('extracts documentation from class list', () => {
    const el = makeElement('<div class="search-result documentation"></div>')
    expect(extractResultType(el)).toBe('documentation')
  })

  test('returns "other" when only search-result class', () => {
    const el = makeElement('<div class="search-result"></div>')
    expect(extractResultType(el)).toBe('other')
  })
})

describe('parseResult', () => {
  const docHtml = `
    <div class="search-result documentation">
      <div class="result-title"><a href="/documentation/SwiftUI/View">View</a></div>
      <div class="result-description">A type that represents part of your app&apos;s UI.</div>
    </div>
  `

  const sampleHtml = `
    <div class="search-result sample_code">
      <div class="result-title"><a href="/documentation/SwiftUI/SampleApp">SampleApp</a></div>
      <div class="result-description">A sample project.</div>
    </div>
  `

  test('parses a documentation result', () => {
    const el = makeElement(docHtml)
    const result = parseResult(el, 'all')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('View')
    expect(result!.url).toBe('https://developer.apple.com/documentation/SwiftUI/View')
    expect(result!.type).toBe('documentation')
    expect(result!.framework).toBe('SwiftUI')
  })

  test('parses a sample_code result', () => {
    const el = makeElement(sampleHtml)
    const result = parseResult(el, 'all')
    expect(result).not.toBeNull()
    expect(result!.type).toBe('sample_code')
  })

  test('documentation filter excludes sample_code', () => {
    const el = makeElement(sampleHtml)
    const result = parseResult(el, 'documentation')
    expect(result).toBeNull()
  })

  test('sample filter excludes documentation', () => {
    const el = makeElement(docHtml)
    const result = parseResult(el, 'sample')
    expect(result).toBeNull()
  })

  test('non-/documentation/ URL is skipped', () => {
    const html = `
      <div class="search-result documentation">
        <div class="result-title"><a href="/design/human-interface-guidelines/overview">HIG</a></div>
        <div class="result-description">Design guidelines.</div>
      </div>
    `
    const el = makeElement(html)
    expect(parseResult(el, 'all')).toBeNull()
  })

  test('framework is extracted and normalized from URL', () => {
    const el = makeElement(docHtml)
    const result = parseResult(el, 'all')
    expect(result!.framework).toBe('SwiftUI')
  })
})
