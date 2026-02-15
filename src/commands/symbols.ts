import { fetchJson } from '../lib/http'
import { APPLE_URLS } from '../lib/urls'
import { cacheGetOrSet, makeCacheKey } from '../lib/cache'

type IndexItem = {
  path: string
  title: string
  type: string
  beta?: boolean
  deprecated?: boolean
  external?: boolean
  children?: IndexItem[]
}

type FrameworkIndex = {
  interfaceLanguages: Record<string, IndexItem[]>
}

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const TYPE_LABELS: Record<string, string> = {
  symbol: 'Symbol',
  module: 'Module',
  class: 'Class',
  struct: 'Struct',
  enum: 'Enum',
  protocol: 'Protocol',
  method: 'Method',
  property: 'Property',
  init: 'Initializer',
  case: 'Case',
  associatedtype: 'Associated Type',
  typealias: 'Type Alias',
  article: 'Article',
  sampleCode: 'Sample Code',
  overview: 'Overview',
  collection: 'Collection',
  func: 'Function',
  var: 'Variable',
  let: 'Constant',
  operator: 'Operator',
  macro: 'Macro',
  namespace: 'Namespace',
}

const PLURAL_RULES: Record<string, string> = {
  Class: 'Classes',
  Property: 'Properties',
  'Associated Type': 'Associated Types',
  'Type Alias': 'Type Aliases',
  'Sample Code': 'Sample Code',
}

function formatTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

function pluralizeType(type: string): string {
  const label = formatTypeLabel(type)
  return PLURAL_RULES[label] || label + 's'
}

function matchesPattern(name: string, pattern: string): boolean {
  const regexPattern = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${regexPattern}$`, 'i').test(name)
}

function findSymbolsRecursive(
  items: IndexItem[],
  symbolType: string,
  namePattern: string | undefined,
  limit: number,
  symbols: IndexItem[],
  depth: number = 0,
): boolean {
  if (depth > 6) return false

  for (const item of items) {
    if (symbols.length >= limit) return true

    if (symbolType === 'all' || item.type === symbolType) {
      if (!namePattern || matchesPattern(item.title, namePattern)) {
        symbols.push(item)
      }
    }

    if (item.children && symbols.length < limit) {
      if (
        findSymbolsRecursive(
          item.children,
          symbolType,
          namePattern,
          limit,
          symbols,
          depth + 1,
        )
      ) {
        return true
      }
    }
  }

  return false
}

function findCollections(items: IndexItem[]): IndexItem[] {
  const collections: IndexItem[] = []

  function search(list: IndexItem[]) {
    for (const item of list) {
      if (item.type === 'collection') collections.push(item)
      if (item.children) search(item.children)
    }
  }

  search(items)
  return collections
}

function formatSymbolItem(item: IndexItem): string {
  const url = `https://developer.apple.com${item.path}`
  let result = `- [**${item.title}**](${url})`

  const metadata: string[] = []
  if (item.beta) metadata.push('Beta')
  if (item.deprecated) metadata.push('Deprecated')
  if (item.type && item.type !== 'groupMarker') {
    metadata.push(formatTypeLabel(item.type))
  }
  if (metadata.length > 0) result += ` *(${metadata.join(', ')})*`

  return result + '\n'
}

export async function searchFrameworkSymbols(
  framework: string,
  symbolType: string = 'all',
  namePattern?: string,
  language: string = 'swift',
  limit: number = 50,
): Promise<string> {
  try {
    const indexUrl = `${APPLE_URLS.TUTORIALS_DATA}index/${framework.toLowerCase()}`
    const cacheKey = makeCacheKey('symbols', {
      framework,
      symbolType,
      namePattern,
      language,
      limit,
    })

    return await cacheGetOrSet(
      cacheKey,
      async () => {
        const data = await fetchJson<FrameworkIndex>(indexUrl)
        const indexItems = data.interfaceLanguages?.[language] || []

        if (indexItems.length === 0) {
          const available = Object.keys(data.interfaceLanguages || {})
          return `Language "${language}" not available for ${framework}. Available languages: ${available.join(', ')}`
        }

        const symbols: IndexItem[] = []
        findSymbolsRecursive(
          indexItems,
          symbolType,
          namePattern,
          limit,
          symbols,
        )

        const typeLabel =
          symbolType === 'all' ? 'Symbols' : pluralizeType(symbolType)
        let result = `# ${framework} Framework ${typeLabel}\n\n`

        if (symbols.length === 0) {
          const typeText =
            symbolType === 'all'
              ? 'symbols'
              : pluralizeType(symbolType).toLowerCase()
          result += `No ${typeText} found`
          if (namePattern) result += ` matching pattern "${namePattern}"`
          result += ` in ${framework} framework.\n`

          const collections = findCollections(indexItems)
          if (collections.length > 0) {
            result += '\n## Try exploring these collections:\n\n'
            for (const col of collections.slice(0, 5)) {
              result += `- [${col.title}](https://developer.apple.com${col.path})\n`
            }
          }
        } else {
          result += `**Found:** ${symbols.length} ${symbolType === 'all' ? 'symbols' : pluralizeType(symbolType).toLowerCase()}`
          if (namePattern) result += ` matching "${namePattern}"`
          result += '\n\n'

          if (symbolType === 'all') {
            const grouped: Record<string, IndexItem[]> = {}
            for (const s of symbols) {
              if (!grouped[s.type]) grouped[s.type] = []
              grouped[s.type].push(s)
            }
            for (const [type, items] of Object.entries(grouped)) {
              result += `## ${pluralizeType(type)} (${items.length})\n\n`
              for (const item of items) {
                result += formatSymbolItem(item)
              }
              result += '\n'
            }
          } else {
            for (const symbol of symbols) {
              result += formatSymbolItem(symbol)
            }
          }
        }

        return result
      },
      CACHE_TTL,
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return `Error searching symbols: ${msg}`
  }
}
