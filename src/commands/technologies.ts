import { fetchJson } from '../lib/http'
import { APPLE_URLS } from '../lib/urls'
import { cacheGetOrSet, makeCacheKey } from '../lib/cache'

type Technology = {
  title: string
  identifier: string
  tags: string[]
  languages: string[]
  url?: string
  destination?: { identifier: string }
}

type TechnologyGroup = {
  name: string
  technologies: Technology[]
}

type TechnologiesData = {
  sections: Array<{
    kind: string
    groups: TechnologyGroup[]
  }>
}

const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

function identifierToWebUrl(id: string): string {
  if (id.startsWith('doc://')) {
    const path = id.replace(/^doc:\/\/[^/]+/, '')
    return `https://developer.apple.com${path}`
  }
  if (id.startsWith('http')) return id
  if (id.startsWith('/')) return `https://developer.apple.com${id}`
  return `https://developer.apple.com/documentation/${id}`
}

export async function listTechnologies(
  category?: string,
  language?: string,
  includeBeta: boolean = true,
  limit: number = 200,
): Promise<string> {
  try {
    const cacheKey = makeCacheKey('technologies', {
      category,
      language,
      includeBeta,
      limit,
    })

    return await cacheGetOrSet(
      cacheKey,
      async () => {
        const data = await fetchJson<TechnologiesData>(
          APPLE_URLS.TECHNOLOGIES_JSON,
        )
        const groups = parseTechnologies(data)
        const filtered = applyFilters(groups, {
          category,
          language,
          includeBeta,
          limit,
        })
        return formatList(filtered)
      },
      CACHE_TTL,
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return `Error: Failed to list technologies: ${msg}`
  }
}

function parseTechnologies(data: TechnologiesData): TechnologyGroup[] {
  const groups: TechnologyGroup[] = []

  for (const section of data.sections ?? []) {
    if (section.kind !== 'technologies' || !section.groups) continue
    for (const group of section.groups) {
      if (!Array.isArray(group.technologies)) continue
      const technologies = group.technologies.map((tech) => ({
        title: tech.title || '',
        identifier: tech.destination?.identifier || tech.identifier || '',
        tags: tech.tags || [],
        languages: tech.languages || [],
        url: tech.destination?.identifier
          ? identifierToWebUrl(tech.destination.identifier)
          : undefined,
      }))
      groups.push({ name: group.name, technologies })
    }
  }

  return groups
}

function applyFilters(
  groups: TechnologyGroup[],
  filters: {
    category?: string
    language?: string
    includeBeta?: boolean
    limit?: number
  },
): TechnologyGroup[] {
  let filtered = groups
    .map((group) => {
      if (
        filters.category &&
        !group.name.toLowerCase().includes(filters.category.toLowerCase())
      ) {
        return null
      }

      const techs = group.technologies.filter((tech) => {
        if (!filters.includeBeta && tech.tags.includes('Beta')) return false
        if (filters.language && !tech.languages.includes(filters.language))
          return false
        return true
      })

      return techs.length > 0 ? { ...group, technologies: techs } : null
    })
    .filter((g): g is TechnologyGroup => g !== null)

  if (filters.limit !== undefined && filters.limit >= 0) {
    if (filters.limit === 0) return []
    let total = 0
    filtered = filtered
      .map((group) => {
        const available = filters.limit! - total
        if (available <= 0) return null
        const limited = group.technologies.slice(0, available)
        total += limited.length
        return { ...group, technologies: limited }
      })
      .filter(
        (g): g is TechnologyGroup => g !== null && g.technologies.length > 0,
      )
  }

  return filtered
}

function formatList(groups: TechnologyGroup[]): string {
  if (groups.length === 0)
    return 'No technologies found matching the specified criteria.'

  let content = '# Apple Developer Technologies\n\n'

  const totalTechs = groups.reduce(
    (sum, g) => sum + g.technologies.length,
    0,
  )
  const betaTechs = groups.reduce(
    (sum, g) =>
      sum + g.technologies.filter((t) => t.tags.includes('Beta')).length,
    0,
  )

  content += `*Found ${totalTechs} technologies`
  if (betaTechs > 0) content += ` (${betaTechs} in beta)`
  content += '*\n\n'

  for (const group of groups) {
    content += `## ${group.name}\n\n`
    for (const tech of group.technologies) {
      const isBeta = tech.tags.includes('Beta')
      const titleWithStatus = isBeta ? `${tech.title} (Beta)` : tech.title
      content += `### [${titleWithStatus}](${tech.url || '#'})\n`

      const metadata: string[] = []
      if (tech.languages.length > 0) {
        metadata.push(`Languages: ${tech.languages.join(', ')}`)
      }
      const nonBetaTags = tech.tags.filter((t) => t !== 'Beta')
      if (nonBetaTags.length > 0) {
        metadata.push(`Categories: ${nonBetaTags.join(', ')}`)
      }
      if (metadata.length > 0) content += `*${metadata.join(' | ')}*\n`
      content += '\n'
    }
  }

  content +=
    '\n---\n\n[View all technologies on Apple Developer](https://developer.apple.com/documentation/technologies)'
  return content
}
