import * as cheerio from 'cheerio'
import { fetchHtml } from '../lib/http'
import { APPLE_URLS } from '../lib/urls'
import { normalizeFramework } from '../lib/frameworks'

type SearchResult = {
  title: string
  url: string
  type: string
  description: string
  framework?: string
  languages?: string[]
  beta?: boolean
}

// Apple uses underscores in CSS classes: sample_code, not sample-code
const TYPE_MAPPING: Record<string, string[]> = {
  all: ['documentation', 'sample_code'],
  documentation: ['documentation'],
  sample: ['sample_code'],
}

const UNSUPPORTED_TYPES = ['general', 'video', 'forums', 'news']

const TYPE_DISPLAY: Record<string, string> = {
  documentation: '## API Documentation',
  sample_code: '## Sample Code',
}

export function extractResultType(
  element: cheerio.Cheerio<cheerio.AnyNode>,
): string {
  const classes = element.attr('class')?.split(/\s+/) ?? []
  for (const cls of classes) {
    if (cls && cls !== 'search-result') return cls
  }
  return 'other'
}

export function parseResult(
  element: cheerio.Cheerio<cheerio.AnyNode>,
  filterType: string,
): SearchResult | null {
  const resultType = extractResultType(element)

  const allowed = TYPE_MAPPING[filterType] ?? TYPE_MAPPING['all']
  if (!allowed.includes(resultType) || UNSUPPORTED_TYPES.includes(resultType)) {
    return null
  }

  const titleEl = element.find('.result-title')
  const title = titleEl.find('a').text().trim()
  let url = titleEl.find('a').attr('href') ?? ''
  if (url.startsWith('/')) url = `https://developer.apple.com${url}`

  if (
    !url ||
    !url.includes('/documentation/') ||
    url.includes('download.apple.com') ||
    url.includes('.zip') ||
    url.includes('/design/human-interface-guidelines/')
  ) {
    return null
  }

  const description = element.find('.result-description').text().trim()

  // Extract framework from URL path
  let framework: string | undefined
  const urlMatch = url.match(/\/documentation\/([^/]+)/)
  if (urlMatch) {
    framework = normalizeFramework(urlMatch[1])
  }

  // Extract languages from result tags
  const languages: string[] = []
  element.find('.result-tag.language').each((_, el) => {
    const lang = cheerio.load(el).text().trim()
    if (lang) languages.push(lang)
  })

  const fullText = element.text()
  const beta = fullText.includes('Beta')

  return {
    title,
    url,
    type: resultType,
    description,
    framework,
    languages: languages.length > 0 ? languages : undefined,
    beta,
  }
}

export async function searchAppleDocs(
  query: string,
  filterType: string = 'all',
  limit: number = 50,
): Promise<string> {
  try {
    // Only pass q to Apple - type filtering is done client-side
    const searchUrl = `${APPLE_URLS.SEARCH}?q=${encodeURIComponent(query)}`
    const html = await fetchHtml(searchUrl)
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    $('.search-result').each((_, el) => {
      if (results.length >= limit) return false
      const result = parseResult($(el), filterType)
      if (result) results.push(result)
      return true
    })

    // Build display URL with filter for the footer link
    const displayUrl =
      filterType === 'all'
        ? searchUrl
        : `${searchUrl}&type=${encodeURIComponent(filterType)}`

    let content = '# Apple Documentation Search Results\n\n'
    content += `**Query:** "${query}"\n`
    if (filterType !== 'all') content += `**Filter:** ${filterType}\n`
    content += `**Results found:** ${results.length}\n\n`

    if (results.length === 0) {
      content += 'No results found.\n\n'
      content += '### Suggestions:\n'
      content += '- Try using different keywords\n'
      content += '- Check spelling\n'
      content += '- Use more general terms\n'
      content += `\n[View search on Apple Developer](${displayUrl})`
      return content
    }

    // Group by type
    const groups: Record<string, SearchResult[]> = {}
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = []
      groups[r.type].push(r)
    }

    for (const [type, items] of Object.entries(groups)) {
      content += `${TYPE_DISPLAY[type] ?? `## ${type}`}\n\n`
      items.forEach((r, i) => {
        content += `### ${i + 1}. ${r.title}`
        if (r.beta) content += ' 🧪 Beta'
        content += '\n\n'
        if (r.framework) content += `**Framework:** ${r.framework}\n`
        if (r.description) content += `**Description:** ${r.description}\n`
        if (r.languages?.length)
          content += `**Languages:** ${r.languages.join(', ')}\n`
        content += `**URL:** ${r.url}\n\n`
      })
    }

    content += `---\n\n[View all results on Apple Developer](${displayUrl})`
    return content
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return `Error searching Apple docs: ${msg}`
  }
}
