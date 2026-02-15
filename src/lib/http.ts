const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; arm64 Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; arm64 Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; arm64 Mac OS X 15_0_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; arm64 Mac OS X 26_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function makeHeaders(): HeadersInit {
  return {
    'User-Agent': randomUA(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  }
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: makeHeaders(),
        signal: AbortSignal.timeout(30_000),
      })

      if (response.status === 404) {
        throw new Error(`Not found (404): ${url}`)
      }

      if (response.status >= 500) {
        throw new Error(`Server error (${response.status}): ${url}`)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`)
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry 404s
      if (lastError.message.includes('404')) throw lastError

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch: ${url}`)
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithRetry(url)
  return response.json() as Promise<T>
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetchWithRetry(url)
  return response.text()
}
