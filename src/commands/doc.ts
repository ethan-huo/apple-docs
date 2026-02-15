import { fetchJson } from '../lib/http'
import { convertToJsonApiUrl } from '../lib/urls'
import { cacheGet, cacheSet, makeCacheKey } from '../lib/cache'
import {
  formatDocHeader,
  formatAbstract,
  formatPlatformAvailability,
  formatSeeAlso,
  isSpecificAPI,
  formatSpecificAPIContent,
  formatAPICollectionContent,
  type AppleDocJSON,
} from '../lib/format'

type DocOptions = {
  related?: boolean
  references?: boolean
  similar?: boolean
  platform?: boolean
}

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export async function getAppleDocContent(
  url: string,
  options: DocOptions = {},
  maxDepth: number = 2,
): Promise<string> {
  try {
    if (!url.includes('developer.apple.com')) {
      return 'Error: URL must be from developer.apple.com'
    }

    const jsonApiUrl = url.includes('.json') ? url : convertToJsonApiUrl(url)
    if (!jsonApiUrl) return 'Error: Invalid Apple Developer Documentation URL'

    const cacheKey = makeCacheKey('doc', { url: jsonApiUrl, ...options })
    const cached = cacheGet<string>(cacheKey)
    if (cached) return cached

    const data = await fetchJson<AppleDocJSON>(jsonApiUrl)

    // If no primary content, follow first reference
    if (
      !data.primaryContentSections &&
      data.references &&
      Object.keys(data.references).length > 0 &&
      maxDepth > 0
    ) {
      const firstRef = Object.values(data.references)[0]
      if (firstRef?.url) {
        const fullRefUrl = firstRef.url.startsWith('http')
          ? firstRef.url
          : `https://developer.apple.com${firstRef.url}`
        const refJsonUrl = convertToJsonApiUrl(fullRefUrl)
        if (refJsonUrl) {
          return getAppleDocContent(refJsonUrl, options, maxDepth - 1)
        }
      }
    }

    let content = ''
    content += formatDocHeader(data)
    content += formatAbstract(data)

    if (isSpecificAPI(data)) {
      content += formatSpecificAPIContent(data)
    } else {
      content += formatAPICollectionContent(data)
    }

    content += formatPlatformAvailability(data)
    content += formatSeeAlso(data)

    // Enhanced analysis sections
    if (options.related) {
      content += formatRelatedApis(data)
    }
    if (options.references) {
      content += formatReferences(data)
    }
    if (options.similar) {
      content += formatSimilarApis(data)
    }
    if (options.platform) {
      content += formatPlatformAnalysis(data)
    }

    content += `---\n\n[View full documentation on Apple Developer](${url})`

    cacheSet(cacheKey, content, CACHE_TTL)
    return content
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return `Error: Failed to get Apple doc content: ${msg}\n\nPlease try accessing the documentation directly at: ${url}`
  }
}

function formatRelatedApis(data: AppleDocJSON): string {
  const related: Array<{ title: string; url: string; relationship: string }> =
    []

  for (const section of data.relationshipsSections ?? []) {
    for (const id of (section.identifiers ?? []).slice(0, 3)) {
      const ref = data.references?.[id]
      if (ref) {
        related.push({
          title: ref.title ?? 'Unknown',
          url: ref.url
            ? ref.url.startsWith('http')
              ? ref.url
              : `https://developer.apple.com${ref.url}`
            : '#',
          relationship: section.title ?? 'Related',
        })
      }
    }
  }

  for (const section of data.seeAlsoSections ?? []) {
    for (const id of (section.identifiers ?? []).slice(0, 3)) {
      const ref = data.references?.[id]
      if (ref) {
        related.push({
          title: ref.title ?? 'Unknown',
          url: ref.url
            ? ref.url.startsWith('http')
              ? ref.url
              : `https://developer.apple.com${ref.url}`
            : '#',
          relationship: `See Also: ${section.title ?? 'Related'}`,
        })
      }
    }
  }

  if (related.length === 0) return ''

  let content = '\n## Related APIs\n\n'
  for (const api of related.slice(0, 10)) {
    content += `- [**${api.title}**](${api.url}) - *${api.relationship}*\n`
  }
  return content + '\n'
}

function formatReferences(data: AppleDocJSON): string {
  if (!data.references) return ''

  const refs = Object.entries(data.references).slice(0, 15)
  if (refs.length === 0) return ''

  let content = '\n## Key References\n\n'
  const grouped: Record<
    string,
    Array<{ title: string; url: string; abstract?: string }>
  > = {}

  for (const [, ref] of refs) {
    const type = ref.role ?? ref.kind ?? 'unknown'
    if (!grouped[type]) grouped[type] = []
    grouped[type].push({
      title: ref.title ?? 'Unknown',
      url: ref.url
        ? ref.url.startsWith('http')
          ? ref.url
          : `https://developer.apple.com${ref.url}`
        : '#',
      abstract: ref.abstract
        ?.map((a) => a?.text ?? '')
        .join(' ')
        .trim(),
    })
  }

  for (const [type, items] of Object.entries(grouped)) {
    content += `### ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`
    for (const item of items.slice(0, 5)) {
      content += `- [**${item.title}**](${item.url})`
      if (item.abstract) {
        content += ` - ${item.abstract.substring(0, 100)}${item.abstract.length > 100 ? '...' : ''}`
      }
      content += '\n'
    }
    content += '\n'
  }

  return content
}

function formatSimilarApis(data: AppleDocJSON): string {
  const similar: Array<{ title: string; url: string; category: string }> = []

  for (const section of data.topicSections ?? []) {
    for (const id of (section.identifiers ?? []).slice(0, 3)) {
      const ref = data.references?.[id]
      if (ref) {
        similar.push({
          title: ref.title ?? 'Unknown',
          url: ref.url
            ? ref.url.startsWith('http')
              ? ref.url
              : `https://developer.apple.com${ref.url}`
            : '#',
          category: section.title ?? 'Related',
        })
      }
    }
  }

  if (similar.length === 0) return ''

  let content = '\n## Similar APIs\n\n'
  const grouped: Record<string, typeof similar> = {}
  for (const api of similar.slice(0, 8)) {
    if (!grouped[api.category]) grouped[api.category] = []
    grouped[api.category].push(api)
  }

  for (const [category, apis] of Object.entries(grouped)) {
    content += `### ${category}\n\n`
    for (const api of apis) {
      content += `- [**${api.title}**](${api.url})\n`
    }
    content += '\n'
  }

  return content
}

function formatPlatformAnalysis(data: AppleDocJSON): string {
  if (!data.metadata?.platforms?.length) return ''

  const platforms = data.metadata.platforms
  const supported = platforms.map((p) => p.name).join(', ')
  const beta = platforms.filter((p) => p.beta).map((p) => p.name)
  const deprecated = platforms.filter((p) => p.deprecated).map((p) => p.name)

  let content = '\n## Platform Compatibility Analysis\n\n'
  content += `**Supported Platforms:** ${supported}\n`
  content += `**Cross-Platform Support:** ${platforms.length > 1 ? 'Yes' : 'No'}\n`

  if (beta.length > 0) content += `**Beta Platforms:** ${beta.join(', ')}\n`
  if (deprecated.length > 0)
    content += `**Deprecated Platforms:** ${deprecated.join(', ')}\n`

  content += '\n**Detailed Platform Information:**\n\n'
  for (const p of platforms) {
    content += `- **${p.name}**`
    if (p.introducedAt) content += ` ${p.introducedAt}+`
    if (p.beta) content += ' (Beta)'
    if (p.deprecated) content += ' (Deprecated)'
    content += '\n'
  }

  return content + '\n'
}
