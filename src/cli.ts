#!/usr/bin/env bun
import { toStandardJsonSchema } from '@valibot/to-json-schema'
import * as v from 'valibot'
import { c, cli, group } from 'argc'
import { searchAppleDocs } from './commands/search'
import { getAppleDocContent } from './commands/doc'
import { listTechnologies } from './commands/technologies'
import { searchFrameworkSymbols } from './commands/symbols'
import { getDocumentationUpdates } from './commands/updates'
import { getSampleCode } from './commands/samples'

const s = toStandardJsonSchema

const schema = {
  search: c
    .meta({
      description: 'Search Apple developer documentation',
      examples: [
        'apple-docs search SwiftUI',
        'apple-docs search "navigation stack" --type documentation',
        'apple-docs search "camera capture" --type sample --limit 10',
      ],
    })
    .args('query')
    .input(
      s(
        v.object({
          query: v.pipe(v.string(), v.description('Search query')),
          type: v.optional(
            v.pipe(
              v.picklist(['all', 'documentation', 'sample']),
              v.description('Filter by result type'),
            ),
            'all',
          ),
          limit: v.optional(
            v.pipe(
              v.number(),
              v.minValue(1),
              v.maxValue(200),
              v.description('Maximum number of results'),
            ),
            50,
          ),
        }),
      ),
    ),

  doc: c
    .meta({
      description: 'Get full documentation page content',
      examples: [
        'apple-docs doc https://developer.apple.com/documentation/swiftui/view',
        'apple-docs doc https://developer.apple.com/documentation/uikit/uiviewcontroller --related --platform',
      ],
    })
    .args('url')
    .input(
      s(
        v.object({
          url: v.pipe(v.string(), v.description('Apple Developer documentation URL')),
          related: v.optional(
            v.pipe(v.boolean(), v.description('Include related APIs')),
            false,
          ),
          references: v.optional(
            v.pipe(v.boolean(), v.description('Include key references')),
            false,
          ),
          similar: v.optional(
            v.pipe(v.boolean(), v.description('Include similar APIs')),
            false,
          ),
          platform: v.optional(
            v.pipe(v.boolean(), v.description('Include platform compatibility analysis')),
            false,
          ),
        }),
      ),
    ),

  technologies: c
    .meta({
      description: 'List all Apple developer technologies and frameworks',
      examples: [
        'apple-docs technologies',
        'apple-docs technologies --category "App Frameworks"',
        'apple-docs technologies --language swift --no-beta',
      ],
    })
    .input(
      s(
        v.object({
          category: v.optional(
            v.pipe(v.string(), v.description('Filter by category name')),
          ),
          language: v.optional(
            v.pipe(
              v.picklist(['swift', 'occ']),
              v.description('Filter by programming language'),
            ),
          ),
          beta: v.optional(
            v.pipe(v.boolean(), v.description('Include beta technologies')),
            true,
          ),
          limit: v.optional(
            v.pipe(
              v.number(),
              v.minValue(0),
              v.maxValue(500),
              v.description('Maximum number of technologies to show'),
            ),
            200,
          ),
        }),
      ),
    ),

  symbols: c
    .meta({
      description: 'Search symbols within a specific Apple framework',
      examples: [
        'apple-docs symbols swiftui',
        'apple-docs symbols uikit --type class --pattern "*Controller"',
        'apple-docs symbols foundation --type protocol --limit 20',
      ],
    })
    .args('framework')
    .input(
      s(
        v.object({
          framework: v.pipe(
            v.string(),
            v.description('Framework identifier in lowercase (e.g. swiftui, uikit, foundation)'),
          ),
          type: v.optional(
            v.pipe(
              v.picklist([
                'all',
                'class',
                'struct',
                'enum',
                'protocol',
                'method',
                'property',
                'init',
                'func',
                'var',
                'let',
                'typealias',
              ]),
              v.description('Filter by symbol type'),
            ),
            'all',
          ),
          pattern: v.optional(
            v.pipe(
              v.string(),
              v.description('Name pattern with wildcards (e.g. "*View", "UI*")'),
            ),
          ),
          language: v.optional(
            v.pipe(
              v.picklist(['swift', 'occ']),
              v.description('Language preference'),
            ),
            'swift',
          ),
          limit: v.optional(
            v.pipe(
              v.number(),
              v.minValue(1),
              v.maxValue(200),
              v.description('Maximum number of results'),
            ),
            50,
          ),
        }),
      ),
    ),

  updates: c
    .meta({
      description: 'Get latest Apple documentation updates',
      examples: [
        'apple-docs updates',
        'apple-docs updates --category wwdc --year 2025',
        'apple-docs updates --technology SwiftUI --limit 20',
      ],
    })
    .input(
      s(
        v.object({
          category: v.optional(
            v.pipe(
              v.picklist(['all', 'wwdc', 'technology', 'release-notes']),
              v.description('Filter by update category'),
            ),
            'all',
          ),
          technology: v.optional(
            v.pipe(v.string(), v.description('Filter by technology name')),
          ),
          year: v.optional(
            v.pipe(v.string(), v.description('Filter by year (for WWDC updates)')),
          ),
          search: v.optional(
            v.pipe(v.string(), v.description('Search query within updates')),
          ),
          beta: v.optional(
            v.pipe(v.boolean(), v.description('Include beta updates')),
            true,
          ),
          limit: v.optional(
            v.pipe(
              v.number(),
              v.minValue(1),
              v.maxValue(200),
              v.description('Maximum number of results'),
            ),
            50,
          ),
        }),
      ),
    ),

  samples: c
    .meta({
      description: 'Browse Apple sample code projects',
      examples: [
        'apple-docs samples',
        'apple-docs samples --framework SwiftUI',
        'apple-docs samples --search "camera" --beta exclude',
      ],
    })
    .input(
      s(
        v.object({
          framework: v.optional(
            v.pipe(v.string(), v.description('Filter by framework name')),
          ),
          beta: v.optional(
            v.pipe(
              v.picklist(['include', 'exclude', 'only']),
              v.description('Beta filter mode'),
            ),
            'include',
          ),
          search: v.optional(
            v.pipe(v.string(), v.description('Search query within samples')),
          ),
          limit: v.optional(
            v.pipe(
              v.number(),
              v.minValue(1),
              v.maxValue(200),
              v.description('Maximum number of results'),
            ),
            50,
          ),
        }),
      ),
    ),
}

const app = cli(schema, {
  name: 'apple-docs',
  version: '0.1.0',
  description: 'Apple Developer Documentation CLI - Search, browse and read Apple developer docs from the terminal',
})

app.run({
  handlers: {
    search: async ({ input }) => {
      const result = await searchAppleDocs(input.query, input.type, input.limit)
      console.log(result)
    },

    doc: async ({ input }) => {
      const result = await getAppleDocContent(input.url, {
        related: input.related,
        references: input.references,
        similar: input.similar,
        platform: input.platform,
      })
      console.log(result)
    },

    technologies: async ({ input }) => {
      const result = await listTechnologies(
        input.category,
        input.language,
        input.beta,
        input.limit,
      )
      console.log(result)
    },

    symbols: async ({ input }) => {
      const result = await searchFrameworkSymbols(
        input.framework,
        input.type,
        input.pattern,
        input.language,
        input.limit,
      )
      console.log(result)
    },

    updates: async ({ input }) => {
      const result = await getDocumentationUpdates(
        input.category,
        input.technology,
        input.year,
        input.search,
        input.beta,
        input.limit,
      )
      console.log(result)
    },

    samples: async ({ input }) => {
      const result = await getSampleCode(
        input.framework,
        input.beta,
        input.search,
        input.limit,
      )
      console.log(result)
    },
  },
})
