import { describe, expect, test } from 'bun:test'
import {
  identifierToUrl,
  formatDocHeader,
  formatAbstract,
  isSpecificAPI,
} from './format'
import type { AppleDocJSON } from './format'

describe('identifierToUrl', () => {
  test('doc:// with documentation path strips bundle ID', () => {
    expect(
      identifierToUrl('doc://com.apple.SwiftUI/documentation/SwiftUI/View'),
    ).toBe('https://developer.apple.com/documentation/SwiftUI/View')
  })

  test('doc:// with tutorials path strips bundle ID', () => {
    expect(
      identifierToUrl('doc://com.apple.documentation/tutorials/swiftui-concepts'),
    ).toBe('https://developer.apple.com/tutorials/swiftui-concepts')
  })

  test('different bundle IDs are handled correctly', () => {
    expect(
      identifierToUrl('doc://com.apple.CoreML/documentation/CoreML/MLModel'),
    ).toBe('https://developer.apple.com/documentation/CoreML/MLModel')
  })

  test('http URL is returned as-is', () => {
    const url = 'https://developer.apple.com/documentation/SwiftUI'
    expect(identifierToUrl(url)).toBe(url)
  })

  test('relative path gets domain prepended', () => {
    expect(identifierToUrl('/documentation/SwiftUI/View')).toBe(
      'https://developer.apple.com/documentation/SwiftUI/View',
    )
  })

  test('bare identifier gets full documentation path', () => {
    expect(identifierToUrl('SwiftUI/View')).toBe(
      'https://developer.apple.com/documentation/SwiftUI/View',
    )
  })
})

describe('formatDocHeader', () => {
  test('renders title with roleHeading and symbolKind', () => {
    const data: AppleDocJSON = {
      metadata: {
        title: 'View',
        roleHeading: 'Protocol',
        symbolKind: 'protocol',
      },
    }
    const result = formatDocHeader(data)
    expect(result).toContain('# View')
    expect(result).toContain('**Protocol**')
    expect(result).toContain('(protocol)')
  })

  test('shows Beta status', () => {
    const data: AppleDocJSON = {
      metadata: {
        title: 'NewAPI',
        platforms: [{ name: 'iOS', beta: true }],
      },
    }
    expect(formatDocHeader(data)).toContain('**Beta**')
  })

  test('shows Deprecated status', () => {
    const data: AppleDocJSON = {
      metadata: {
        title: 'OldAPI',
        platforms: [{ name: 'iOS', deprecated: true }],
      },
    }
    expect(formatDocHeader(data)).toContain('**Deprecated**')
  })

  test('falls back to data.title when metadata.title is missing', () => {
    const data: AppleDocJSON = { title: 'FallbackTitle' }
    expect(formatDocHeader(data)).toContain('# FallbackTitle')
  })

  test('falls back to "Documentation" when no title at all', () => {
    const data: AppleDocJSON = {}
    expect(formatDocHeader(data)).toContain('# Documentation')
  })
})

describe('formatAbstract', () => {
  test('concatenates text items', () => {
    const data: AppleDocJSON = {
      abstract: [
        { text: 'A view that', type: 'text' },
        { text: 'displays content.', type: 'text' },
      ],
    }
    expect(formatAbstract(data)).toBe('A view that displays content.\n\n')
  })

  test('empty array returns empty string', () => {
    const data: AppleDocJSON = { abstract: [] }
    expect(formatAbstract(data)).toBe('')
  })

  test('null/undefined abstract returns empty string', () => {
    expect(formatAbstract({})).toBe('')
    expect(formatAbstract({ abstract: undefined })).toBe('')
  })
})

describe('isSpecificAPI', () => {
  test('returns true when declarations section exists', () => {
    const data: AppleDocJSON = {
      primaryContentSections: [{ kind: 'declarations' }],
    }
    expect(isSpecificAPI(data)).toBe(true)
  })

  test('returns false when no declarations section', () => {
    const data: AppleDocJSON = {
      primaryContentSections: [{ kind: 'content' }],
    }
    expect(isSpecificAPI(data)).toBe(false)
  })

  test('returns false when no primaryContentSections', () => {
    expect(isSpecificAPI({})).toBe(false)
  })
})
