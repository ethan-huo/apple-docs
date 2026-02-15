import { fetchJson } from '../lib/http'
import { APPLE_URLS } from '../lib/urls'
import { cacheGetOrSet, makeCacheKey } from '../lib/cache'
import { normalizeFramework } from '../lib/frameworks'

type SampleCodeIndexNode = {
  path?: string
  title: string
  type: string
  children?: SampleCodeIndexNode[]
  external?: boolean
  beta?: boolean
}

type SampleCodeIndex = {
  interfaceLanguages: Record<string, SampleCodeIndexNode[]>
}

type SampleCodeContent = {
  metadata: { role: string; title: string }
  abstract?: Array<{ type: string; text: string }>
  primaryContentSections?: Array<{
    kind: string
    content: Array<{
      type: string
      items?: string[]
    }>
  }>
  topicSections?: Array<{
    anchor: string
    title: string
    identifiers: string[]
  }>
}

type ParsedSampleCode = {
  title: string
  framework?: string
  description?: string
  beta: boolean
  featured: boolean
  url: string
  path: string
  depth: number
}

const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

function extractFrameworkFromPath(path: string): string | null {
  const match = path.match(/^\/documentation\/([^/]+)\//)
  if (match) {
    const fw = match[1]
    if (fw === 'samplecode' || fw === 'documentation') return null
    return normalizeFramework(fw)
  }
  return null
}

function processSampleCodeNodes(
  nodes: SampleCodeIndexNode[],
  sampleCodes: ParsedSampleCode[],
  frameworkMap: Map<string, string>,
  featuredIds: Set<string>,
  currentFramework: string,
  depth: number,
): void {
  for (const node of nodes) {
    if (node.type === 'groupMarker') {
      const fw = normalizeFramework(node.title)
      if (node.children) {
        processSampleCodeNodes(
          node.children,
          sampleCodes,
          frameworkMap,
          featuredIds,
          fw,
          depth + 1,
        )
      }
    } else if (node.type === 'sampleCode' && node.path) {
      const fwFromPath = extractFrameworkFromPath(node.path)
      const docUrl = `doc://com.apple.documentation${node.path}`
      const fwFromMap = frameworkMap.get(docUrl)
      const fw = normalizeFramework(
        fwFromPath || fwFromMap || currentFramework,
      )

      sampleCodes.push({
        title: node.title,
        framework: fw || undefined,
        beta: node.beta || false,
        featured: featuredIds.has(docUrl),
        url: `https://developer.apple.com${node.path}`,
        path: node.path,
        depth,
      })
    } else if (node.children) {
      processSampleCodeNodes(
        node.children,
        sampleCodes,
        frameworkMap,
        featuredIds,
        currentFramework,
        depth + 1,
      )
    }
  }
}

export async function getSampleCode(
  framework?: string,
  beta: 'include' | 'exclude' | 'only' = 'include',
  searchQuery?: string,
  limit: number = 50,
): Promise<string> {
  try {
    const cacheKey = makeCacheKey('samples', {
      framework,
      beta,
      searchQuery,
      limit,
    })

    return await cacheGetOrSet(
      cacheKey,
      async () => {
        const [contentData, indexData] = await Promise.all([
          fetchJson<SampleCodeContent>(APPLE_URLS.SAMPLE_CODE_JSON),
          fetchJson<SampleCodeIndex>(APPLE_URLS.SAMPLE_CODE_INDEX_JSON),
        ])

        // Extract featured IDs
        const featuredIds = new Set<string>()
        for (const section of contentData.primaryContentSections ?? []) {
          if (section.kind === 'content') {
            for (const item of section.content ?? []) {
              if (item.type === 'links' && item.items) {
                for (const id of item.items) featuredIds.add(id)
              }
            }
          }
        }

        // Build framework map from topic sections
        const frameworkMap = new Map<string, string>()
        for (const section of contentData.topicSections ?? []) {
          for (const id of section.identifiers) {
            frameworkMap.set(id, section.title)
          }
        }

        // Parse index
        const sampleCodes: ParsedSampleCode[] = []
        for (const [, nodes] of Object.entries(
          indexData.interfaceLanguages,
        )) {
          processSampleCodeNodes(
            nodes,
            sampleCodes,
            frameworkMap,
            featuredIds,
            '',
            0,
          )
        }

        // Deduplicate
        const uniqueMap = new Map<string, ParsedSampleCode>()
        for (const code of sampleCodes) {
          const existing = uniqueMap.get(code.path)
          if (!existing) {
            uniqueMap.set(code.path, code)
          } else {
            uniqueMap.set(code.path, {
              ...existing,
              framework: code.framework || existing.framework,
              featured: code.featured || existing.featured,
              beta: code.beta || existing.beta,
              depth: Math.min(code.depth, existing.depth),
            })
          }
        }
        let results = Array.from(uniqueMap.values())

        // Filter
        if (framework) {
          const fwLower = normalizeFramework(framework).toLowerCase()
          results = results.filter((c) => {
            const codeFw = normalizeFramework(c.framework || '').toLowerCase()
            return (
              fwLower === codeFw ||
              codeFw.includes(fwLower) ||
              c.title.toLowerCase().includes(fwLower) ||
              c.path.toLowerCase().includes(fwLower)
            )
          })
        }
        if (beta === 'exclude') results = results.filter((c) => !c.beta)
        else if (beta === 'only') results = results.filter((c) => c.beta)
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          results = results.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              (c.framework || '').toLowerCase().includes(q) ||
              c.path.toLowerCase().includes(q),
          )
        }

        const totalFound = results.length

        // Sort: featured first, then alphabetically
        results.sort((a, b) => {
          if (a.featured && !b.featured) return -1
          if (!a.featured && b.featured) return 1
          return a.title.localeCompare(b.title)
        })
        results = results.slice(0, limit)

        return formatSamples(results, {
          framework,
          beta,
          searchQuery,
          totalFound,
          showing: results.length,
        })
      },
      CACHE_TTL,
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return `Error fetching sample code: ${msg}`
  }
}

function formatSamples(
  samples: ParsedSampleCode[],
  opts: {
    framework?: string
    beta?: string
    searchQuery?: string
    totalFound: number
    showing: number
  },
): string {
  const lines: string[] = ['# Apple Sample Code Library', '']

  const filterParts: string[] = []
  if (opts.framework)
    filterParts.push(`Framework: ${normalizeFramework(opts.framework)}`)
  if (opts.beta && opts.beta !== 'include')
    filterParts.push(`Beta: ${opts.beta}`)
  if (opts.searchQuery) filterParts.push(`Search: "${opts.searchQuery}"`)

  if (filterParts.length > 0) {
    lines.push('## Filters Applied')
    lines.push(filterParts.join(', '))
    lines.push('')
  }

  lines.push(
    `Found ${opts.totalFound} sample code projects${opts.showing < opts.totalFound ? `, showing ${opts.showing}` : ''}`,
  )
  lines.push('')

  if (samples.length === 0) {
    lines.push('No sample code projects found matching your criteria.')
    return lines.join('\n')
  }

  // Featured
  const featured = samples.filter((c) => c.featured)
  if (featured.length > 0) {
    lines.push('## Featured Samples')
    lines.push('')
    for (const c of featured) {
      lines.push(formatSampleItem(c, false))
    }
    lines.push('')
  }

  // Group by framework
  const byCategory = new Map<string, ParsedSampleCode[]>()
  const noCategory: ParsedSampleCode[] = []

  for (const code of samples) {
    if (code.featured) continue
    if (code.framework) {
      const cat = code.framework.match(/^WWDC\d+$/i)
        ? code.framework.toUpperCase()
        : code.framework
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(code)
    } else {
      noCategory.push(code)
    }
  }

  const sortedCategories = Array.from(byCategory.keys()).sort((a, b) => {
    const aWwdc = a.match(/^WWDC(\d+)$/)
    const bWwdc = b.match(/^WWDC(\d+)$/)
    if (aWwdc && bWwdc)
      return parseInt(bWwdc[1]) - parseInt(aWwdc[1])
    if (aWwdc) return -1
    if (bWwdc) return 1
    return a.localeCompare(b)
  })

  for (const cat of sortedCategories) {
    const codes = byCategory.get(cat)!
    if (codes.length > 0) {
      lines.push(`## ${cat}`)
      lines.push('')
      for (const c of codes) {
        lines.push(formatSampleItem(c, false))
      }
      lines.push('')
    }
  }

  if (noCategory.length > 0) {
    lines.push('## Other')
    lines.push('')
    for (const c of noCategory) {
      lines.push(formatSampleItem(c, false))
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

function formatSampleItem(
  code: ParsedSampleCode,
  showFramework: boolean,
): string {
  const badges: string[] = []
  if (code.beta) badges.push('Beta')
  const badgeStr = badges.length > 0 ? ` *${badges.join(' ')}*` : ''
  const fwStr =
    showFramework && code.framework ? ` (${code.framework})` : ''
  let line = `### [${code.title}](${code.url})${badgeStr}${fwStr}`
  if (code.description) line += `\n${code.description}`
  return line
}
