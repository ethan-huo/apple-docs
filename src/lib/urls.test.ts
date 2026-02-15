import { describe, expect, test } from 'bun:test'
import { convertToJsonApiUrl, isValidAppleDeveloperUrl } from './urls'

describe('convertToJsonApiUrl', () => {
  test('/documentation/ path converts to tutorials/data/documentation/*.json', () => {
    const result = convertToJsonApiUrl(
      'https://developer.apple.com/documentation/SwiftUI/View',
    )
    expect(result).toBe(
      'https://developer.apple.com/tutorials/data/documentation/SwiftUI/View.json',
    )
  })

  test('/tutorials/ path converts to tutorials/data/*.json', () => {
    const result = convertToJsonApiUrl(
      'https://developer.apple.com/tutorials/swiftui-concepts',
    )
    expect(result).toBe(
      'https://developer.apple.com/tutorials/data/swiftui-concepts.json',
    )
  })

  test('strips trailing slash before conversion', () => {
    const result = convertToJsonApiUrl(
      'https://developer.apple.com/documentation/SwiftUI/',
    )
    expect(result).toBe(
      'https://developer.apple.com/tutorials/data/documentation/SwiftUI.json',
    )
  })

  test('non-Apple domain returns null', () => {
    expect(convertToJsonApiUrl('https://example.com/documentation/Foo')).toBeNull()
  })

  test('invalid URL returns null', () => {
    expect(convertToJsonApiUrl('not a url')).toBeNull()
  })

  test('URL without /documentation/ or /tutorials/ returns original', () => {
    const url = 'https://developer.apple.com/design'
    expect(convertToJsonApiUrl(url)).toBe(url)
  })
})

describe('isValidAppleDeveloperUrl', () => {
  test('valid Apple developer URL', () => {
    expect(
      isValidAppleDeveloperUrl('https://developer.apple.com/documentation/SwiftUI'),
    ).toBe(true)
  })

  test('non-Apple URL', () => {
    expect(isValidAppleDeveloperUrl('https://google.com')).toBe(false)
  })

  test('invalid URL', () => {
    expect(isValidAppleDeveloperUrl('garbage')).toBe(false)
  })
})
