import { fetchJson } from '../lib/http'
import { APPLE_URLS } from '../lib/urls'
import { cacheGetOrSet, makeCacheKey } from '../lib/cache'

type UpdateCategory = 'wwdc' | 'technology' | 'release-notes' | 'other'

type UpdateItem = {
  title: string
  url: string
  description: string
  category: UpdateCategory
  type: string
  identifier: string
  technology?: string
  year?: string
  beta?: boolean
  images?: Array<{ type: string; identifier: string }>
}

type UpdatesData = {
  topicSections: Array<{
    title: string
    identifiers: string[]
    anchor: string
  }>
  references: Record<
    string,
    {
      type: string
      title: string
      url: string
      abstract?: Array<{ text: string; type: string }>
      images?: Array<{ type: string; identifier: string }>
      kind?: string
      role?: string
    }
  >
}

type UpdatesIndexData = {
  interfaceLanguages: {
    swift: UpdatesIndexSection[]
  }
}

type UpdatesIndexSection = {
  path: string
  title: string
  type: string
  beta?: boolean
  children?: UpdatesIndexSection[]
}

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getSectionCategory(title: string): UpdateCategory {
  const lower = title.toLowerCase()
  if (lower.includes('wwdc')) return 'wwdc'
  if (lower.includes('release notes')) return 'release-notes'
  if (lower.includes('technology')) return 'technology'
  return 'other'
}

function extractTechFromPath(path: string): string | undefined {
  const match = path.match(/\/documentation\/updates\/([^/]+)/i)
  if (match?.[1]) {
    return match[1]
      .replace(/-/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  return undefined
}

function parseUpdates(
  data: UpdatesData,
  index: UpdatesIndexData,
): UpdateItem[] {
  const updates: UpdateItem[] = []

  for (const section of data.topicSections ?? []) {
    const category = getSectionCategory(section.title)

    for (const id of section.identifiers) {
      const ref = data.references[id]
      if (!ref) continue

      const item: UpdateItem = {
        title: ref.title,
        url: ref.url ? `https://developer.apple.com${ref.url}` : '',
        description: ref.abstract?.[0]?.text ?? '',
        category,
        type: ref.kind ?? 'update',
        identifier: id,
        images: ref.images,
      }

      if (category === 'wwdc' && ref.title) {
        const yearMatch = ref.title.match(/WWDC(\d{2,4})/)
        if (yearMatch) {
          item.year =
            yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1]
        }
      }

      updates.push(item)
    }
  }

  // Enrich from index
  if (index.interfaceLanguages?.swift) {
    processIndex(index.interfaceLanguages.swift, updates)
  }

  return updates
}

function processIndex(sections: UpdatesIndexSection[], updates: UpdateItem[]) {
  for (const section of sections) {
    const match = updates.find(
      (u) => u.url.includes(section.path) || u.title === section.title,
    )
    if (match) {
      match.beta = section.beta ?? false
      match.technology = extractTechFromPath(section.path)
    }
    if (section.children) processIndex(section.children, updates)
  }
}

export async function getDocumentationUpdates(
  category: string = 'all',
  technology?: string,
  year?: string,
  searchQuery?: string,
  includeBeta: boolean = true,
  limit: number = 50,
): Promise<string> {
  try {
    const cacheKey = makeCacheKey('updates', {
      category,
      technology,
      year,
      searchQuery,
      includeBeta,
      limit,
    })

    return await cacheGetOrSet(
      cacheKey,
      async () => {
        const [updatesData, updatesIndex] = await Promise.all([
          fetchJson<UpdatesData>(APPLE_URLS.UPDATES_JSON),
          fetchJson<UpdatesIndexData>(APPLE_URLS.UPDATES_INDEX_JSON),
        ])

        let updates = parseUpdates(updatesData, updatesIndex)

        // Apply filters
        if (category !== 'all') {
          updates = updates.filter((u) => u.category === category)
        }
        if (technology) {
          const techLower = technology.toLowerCase()
          updates = updates.filter(
            (u) =>
              u.technology?.toLowerCase().includes(techLower) ||
              u.title.toLowerCase().includes(techLower) ||
              u.description.toLowerCase().includes(techLower),
          )
        }
        if (year) {
          updates = updates.filter((u) => u.year === year)
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          updates = updates.filter(
            (u) =>
              u.title.toLowerCase().includes(q) ||
              u.description.toLowerCase().includes(q),
          )
        }
        if (!includeBeta) {
          updates = updates.filter((u) => !u.beta)
        }
        if (limit > 0) {
          updates = updates.slice(0, limit)
        }

        return formatUpdates(updates)
      },
      CACHE_TTL,
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return `Error: Failed to fetch documentation updates: ${msg}`
  }
}

function formatUpdates(updates: UpdateItem[]): string {
  if (updates.length === 0)
    return 'No documentation updates found matching the specified criteria.'

  let content = '# Apple Developer Documentation Updates\n\n'

  // Group by category
  const grouped: Record<string, UpdateItem[]> = {}
  for (const u of updates) {
    if (!grouped[u.category]) grouped[u.category] = []
    grouped[u.category].push(u)
  }

  const categoryTitles: Record<string, string> = {
    wwdc: 'WWDC',
    technology: 'Technology Updates',
    'release-notes': 'Release Notes',
    other: 'Other Updates',
  }

  for (const [cat, items] of Object.entries(grouped)) {
    content += `## ${categoryTitles[cat] ?? cat}\n\n`

    for (const item of items) {
      let titleLine = `### [${item.title}](${item.url})`
      const badges: string[] = []
      if (item.beta) badges.push('Beta')
      if (item.images?.some((img) => img.identifier === 'new.svg'))
        badges.push('New')
      if (badges.length > 0) titleLine += ` *${badges.join(' | ')}*`

      content += titleLine + '\n'
      if (item.description) content += `${item.description}\n`

      const metadata: string[] = []
      if (item.technology && item.category !== 'technology')
        metadata.push(`Technology: ${item.technology}`)
      if (item.year && item.category === 'wwdc')
        metadata.push(`Year: ${item.year}`)
      if (metadata.length > 0) content += `*${metadata.join(' | ')}*\n`
      content += '\n'
    }
  }

  content +=
    '\n---\n\n[View all updates on Apple Developer](https://developer.apple.com/documentation/updates)'
  return content
}
