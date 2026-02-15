export const APPLE_URLS = {
  BASE: 'https://developer.apple.com',
  SEARCH: 'https://developer.apple.com/search/',
  DOCUMENTATION: 'https://developer.apple.com/documentation/',
  TUTORIALS_DATA: 'https://developer.apple.com/tutorials/data/',
  TECHNOLOGIES_JSON:
    'https://developer.apple.com/tutorials/data/documentation/technologies.json',
  UPDATES_JSON:
    'https://developer.apple.com/tutorials/data/documentation/Updates.json',
  UPDATES_INDEX_JSON:
    'https://developer.apple.com/tutorials/data/index/updates',
  SAMPLE_CODE_JSON:
    'https://developer.apple.com/tutorials/data/documentation/SampleCode.json',
  SAMPLE_CODE_INDEX_JSON:
    'https://developer.apple.com/tutorials/data/index/samplecode',
} as const

export function convertToJsonApiUrl(webUrl: string): string | null {
  try {
    let cleaned = webUrl.endsWith('/') ? webUrl.slice(0, -1) : webUrl
    const urlObj = new URL(cleaned)

    if (urlObj.hostname !== 'developer.apple.com') return null

    const path = urlObj.pathname

    if (path.includes('/documentation/')) {
      const docPath = path.replace('/documentation/', '')
      return `https://developer.apple.com/tutorials/data/documentation/${docPath}.json`
    }

    if (path.includes('/tutorials/')) {
      const tutorialPath = path.replace('/tutorials/', '')
      return `https://developer.apple.com/tutorials/data/${tutorialPath}.json`
    }

    return webUrl
  } catch {
    return null
  }
}

export function isValidAppleDeveloperUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'developer.apple.com'
  } catch {
    return false
  }
}
