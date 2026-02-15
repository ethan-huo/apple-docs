import { describe, expect, test } from 'bun:test'
import { normalizeFramework } from './frameworks'

describe('normalizeFramework', () => {
  test('known mapping: swiftui -> SwiftUI', () => {
    expect(normalizeFramework('swiftui')).toBe('SwiftUI')
  })

  test('known mapping: avfoundation -> AVFoundation', () => {
    expect(normalizeFramework('avfoundation')).toBe('AVFoundation')
  })

  test('known mapping: coreml -> Core ML', () => {
    expect(normalizeFramework('coreml')).toBe('Core ML')
  })

  test('unknown name gets capitalized first letter', () => {
    expect(normalizeFramework('foobar')).toBe('Foobar')
  })

  test('empty string returns empty string', () => {
    expect(normalizeFramework('')).toBe('')
  })

  test('case insensitive: SwiftUI input still maps correctly', () => {
    expect(normalizeFramework('SwiftUI')).toBe('SwiftUI')
  })

  test('case insensitive: UIKIT maps correctly', () => {
    expect(normalizeFramework('UIKIT')).toBe('UIKit')
  })

  test('trims whitespace', () => {
    expect(normalizeFramework('  swiftui  ')).toBe('SwiftUI')
  })
})
