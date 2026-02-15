# apple-docs

Apple Developer Documentation CLI for AI Agents. Search, browse, and read Apple's developer docs from the terminal — no browser needed.

## Why

AI coding agents working with Apple frameworks need fast access to API docs, symbol lists, and platform availability. `apple-docs` turns Apple's documentation site into a structured CLI that agents (and humans) can query directly.

## Install

```bash
# requires: bun
bun install -g github:ethan-huo/apple-docs
```

As a [skill](https://skills.sh) (Claude Code, Codex, Cursor, etc.):

```bash
bunx skills add ethan-huo/apple-docs
```

## Schema

`apple-docs --schema` — view the full typed command spec at once.

## Usage

```bash
# Search documentation
apple-docs search "navigation stack"
apple-docs search "camera capture" --type sample --limit 10

# Read a full documentation page
apple-docs doc https://developer.apple.com/documentation/swiftui/view
apple-docs doc https://developer.apple.com/documentation/uikit/uiviewcontroller --related --platform

# List all Apple frameworks and technologies
apple-docs technologies
apple-docs technologies --category "App Frameworks" --language swift --no-beta

# Search symbols within a framework
apple-docs symbols swiftui --type protocol --pattern "*Style"
apple-docs symbols foundation --type class --limit 20

# Get latest documentation updates
apple-docs updates --category wwdc --year 2025
apple-docs updates --technology SwiftUI

# Browse sample code projects
apple-docs samples --framework RealityKit
apple-docs samples --search "camera" --beta exclude
```

## Example: Exploring an API

```bash
# 1. Search for a topic
apple-docs search "SwiftUI navigation"

# 2. Read the full page (with related APIs and platform availability)
apple-docs doc https://developer.apple.com/documentation/swiftui/navigationstack --related --platform

# 3. Discover related protocols
apple-docs symbols swiftui --type protocol --pattern "Navigation*"
```

## Flags

| Command | Key Flags |
|---------|-----------|
| `search` | `--type all\|documentation\|sample` `--limit` |
| `doc` | `--related` `--references` `--similar` `--platform` |
| `technologies` | `--category` `--language swift\|occ` `--beta` `--limit` |
| `symbols` | `--type class\|struct\|enum\|protocol\|...` `--pattern` `--language` `--limit` |
| `updates` | `--category all\|wwdc\|technology\|release-notes` `--technology` `--year` `--search` `--limit` |
| `samples` | `--framework` `--search` `--beta include\|exclude\|only` `--limit` |

All output is Markdown.

## Built With

- [argc](https://github.com/user/argc) — schema-first CLI framework for Bun
- [cheerio](https://cheerio.js.org/) — HTML parsing for search results
- [Bun](https://bun.sh/) — runtime (no build step, runs TypeScript directly)

## License

MIT
