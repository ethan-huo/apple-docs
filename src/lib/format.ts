// Shared formatting helpers ported from apple-docs-mcp doc-formatter.ts

type AppleDocJSON = {
  metadata?: {
    title?: string
    roleHeading?: string
    symbolKind?: string
    platforms?: Array<{
      name?: string
      introducedAt?: string
      beta?: boolean
      deprecated?: boolean
      deprecatedAt?: string
      obsoletedAt?: string
      unavailable?: boolean
    }>
  }
  title?: string
  abstract?: Array<{ text?: string; type?: string }>
  primaryContentSections?: Array<Record<string, unknown>>
  topicSections?: Array<{
    title?: string
    identifiers?: string[]
  }>
  seeAlsoSections?: Array<{
    title?: string
    identifiers?: string[]
  }>
  relationshipsSections?: Array<{
    title?: string
    identifiers?: string[]
  }>
  references?: Record<
    string,
    {
      title?: string
      url?: string
      role?: string
      kind?: string
      abstract?: Array<{ text?: string }>
    }
  >
}

export type { AppleDocJSON }

// Convert doc:// identifier to a proper Apple Developer URL
// e.g. "doc://com.apple.SwiftUI/documentation/SwiftUI/View" -> "https://developer.apple.com/documentation/SwiftUI/View"
// e.g. "doc://com.apple.documentation/tutorials/swiftui-concepts" -> "https://developer.apple.com/tutorials/swiftui-concepts"
export function identifierToUrl(id: string): string {
  if (id.startsWith('doc://')) {
    const path = id.replace(/^doc:\/\/[^/]+/, '')
    return `https://developer.apple.com${path}`
  }
  // Already a path or URL
  if (id.startsWith('http')) return id
  if (id.startsWith('/')) return `https://developer.apple.com${id}`
  return `https://developer.apple.com/documentation/${id}`
}

export function formatDocHeader(data: AppleDocJSON): string {
  let content = ''
  const title = data.metadata?.title ?? data.title ?? 'Documentation'
  const statusInfo: string[] = []

  if (data.metadata?.platforms?.some((p) => p.beta)) statusInfo.push('**Beta**')
  if (data.metadata?.platforms?.some((p) => p.deprecated))
    statusInfo.push('**Deprecated**')

  const statusText = statusInfo.length > 0 ? ` (${statusInfo.join(', ')})` : ''
  content += `# ${title}${statusText}\n\n`

  if (data.metadata?.roleHeading) {
    let roleInfo = `**${data.metadata.roleHeading}**`
    if (data.metadata?.symbolKind) roleInfo += ` (${data.metadata.symbolKind})`
    content += `${roleInfo}\n\n`
  }

  return content
}

export function formatAbstract(data: AppleDocJSON): string {
  if (!data.abstract || !Array.isArray(data.abstract)) return ''
  const text = data.abstract
    .map((item) => item?.text ?? '')
    .join(' ')
    .trim()
  return text ? `${text}\n\n` : ''
}

export function formatPlatformAvailability(data: AppleDocJSON): string {
  if (!data.metadata?.platforms?.length) return ''

  let content = '## Platform Availability\n\n'
  for (const p of data.metadata.platforms) {
    let line = `- **${p.name}** ${p.introducedAt ?? 'Unknown'}+`
    if (p.deprecatedAt) line += ` | Deprecated in ${p.deprecatedAt}`
    if (p.obsoletedAt) line += ` | Obsoleted in ${p.obsoletedAt}`

    const status: string[] = []
    if (p.beta) status.push('Beta')
    if (p.deprecated) status.push('Deprecated')
    if (p.unavailable) status.push('Unavailable')
    if (status.length > 0) line += ` | Status: ${status.join(', ')}`

    content += `${line}\n`
  }
  return content + '\n'
}

export function isSpecificAPI(data: AppleDocJSON): boolean {
  return (
    data.primaryContentSections?.some(
      (s) => (s as { kind?: string })?.kind === 'declarations',
    ) ?? false
  )
}

export function formatSpecificAPIContent(data: AppleDocJSON): string {
  let content = ''
  if (!data.primaryContentSections) return content

  for (const section of data.primaryContentSections) {
    const s = section as Record<string, unknown>
    switch (s.kind) {
      case 'declarations': {
        content += '## Declaration\n\n'
        const declarations = s.declarations as Array<{
          tokens?: Array<{ text?: string }>
        }>
        if (declarations?.[0]?.tokens) {
          const decl = declarations[0].tokens.map((t) => t.text ?? '').join('')
          content += `\`\`\`swift\n${decl}\`\`\`\n\n`
        }
        break
      }
      case 'parameters': {
        content += '## Parameters\n\n'
        const params = s.parameters as Array<{
          name: string
          content?: Array<{
            inlineContent?: Array<{ text?: string }>
          }>
        }>
        if (Array.isArray(params)) {
          for (const param of params) {
            content += `**${param.name}**: `
            if (param.content?.[0]?.inlineContent) {
              const desc = param.content[0].inlineContent
                .map((i) => i?.text ?? '')
                .join('')
              content += `${desc}\n\n`
            }
          }
        }
        break
      }
      case 'content': {
        const items = s.content as Array<Record<string, unknown>>
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.type === 'heading') {
              content += `## ${item.text}\n\n`
            } else if (
              item.type === 'paragraph' &&
              Array.isArray(item.inlineContent)
            ) {
              const text = (item.inlineContent as Array<Record<string, unknown>>)
                .map((inline) => {
                  if (inline.type === 'text') return (inline.text as string) ?? ''
                  if (inline.type === 'codeVoice')
                    return `\`${(inline.code as string) ?? ''}\``
                  if (inline.type === 'reference' && inline.identifier) {
                    const apiName = (inline.identifier as string)
                      .split('/')
                      .pop()
                    return `\`${apiName}\``
                  }
                  return ''
                })
                .join('')
              if (text.trim()) content += `${text}\n\n`
            } else if (item.type === 'codeListing' && item.code) {
              const code = (item.code as string[]).join('\n')
              content += `\`\`\`${(item.syntax as string) ?? 'swift'}\n${code}\`\`\`\n\n`
            }
          }
        }
        break
      }
    }
  }
  return content
}

export function formatAPICollectionContent(data: AppleDocJSON): string {
  let content = ''

  // Overview from primary content sections
  if (data.primaryContentSections?.length) {
    content += '## Overview\n\n'
    for (const section of data.primaryContentSections) {
      const s = section as Record<string, unknown>
      if (s.kind === 'content' && Array.isArray(s.content)) {
        for (const item of s.content as Array<Record<string, unknown>>) {
          if (item.type === 'paragraph' && Array.isArray(item.inlineContent)) {
            const text = (
              item.inlineContent as Array<Record<string, unknown>>
            )
              .map((inline) => {
                if (inline.type === 'text') return (inline.text as string) ?? ''
                if (inline.type === 'reference' && inline.identifier) {
                  return `\`${(inline.identifier as string).split('/').pop()}\``
                }
                return ''
              })
              .join('')
            if (text.trim()) content += `${text}\n\n`
          } else if (
            item.type === 'unorderedList' &&
            Array.isArray(item.items)
          ) {
            for (const li of item.items as Array<Record<string, unknown>>) {
              const liContent = li.content as Array<Record<string, unknown>>
              if (liContent?.[0] && Array.isArray((liContent[0] as Record<string, unknown>).inlineContent)) {
                const text = (
                  (liContent[0] as Record<string, unknown>).inlineContent as Array<Record<string, unknown>>
                )
                  .map((inline) => {
                    if (inline.type === 'text')
                      return (inline.text as string) ?? ''
                    if (inline.type === 'reference' && inline.identifier) {
                      return `\`${(inline.identifier as string).split('/').pop()}\``
                    }
                    return ''
                  })
                  .join('')
                if (text.trim()) content += `- ${text}\n`
              }
            }
            content += '\n'
          }
        }
      }
    }
  }

  // Topic sections (API Collections)
  if (data.topicSections?.length) {
    content += '## APIs and Functions\n\n'
    for (const section of data.topicSections) {
      if (section.title && section.identifiers?.length) {
        content += `### ${section.title}\n\n`
        for (const id of section.identifiers) {
          const apiName = id.split('/').pop() ?? id
          content += `- [\`${apiName}\`](${identifierToUrl(id)})\n`
        }
        content += '\n'
      }
    }
  }

  return content
}

export function formatSeeAlso(data: AppleDocJSON): string {
  if (!data.seeAlsoSections?.length) return ''

  let content = '## See Also\n\n'
  for (const section of data.seeAlsoSections) {
    if (section.title && section.identifiers?.length) {
      content += `### ${section.title}\n\n`
      for (const id of section.identifiers) {
        const apiName = id.split('/').pop() ?? id
        content += `- [\`${apiName}\`](${identifierToUrl(id)})\n`
      }
      content += '\n'
    }
  }
  return content
}
