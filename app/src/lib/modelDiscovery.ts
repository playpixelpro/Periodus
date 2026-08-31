import { cleanBaseUrl } from './assistant'
import { providerFetch } from './providerFetch'

/**
 * Discovery of available models for OpenAI-compatible custom endpoints.
 *
 * Most compatible servers (OpenRouter, DeepSeek, Groq, Mistral, Ollama, LM
 * Studio, vLLM, …) expose a `GET …/models` list. We probe a few conventional
 * paths and return the `id`s so the user can pick instead of guessing a model
 * name.
 */

export interface AvailableModel {
  id: string
  ownedBy?: string
}

type FetchLike = typeof fetch

/** Candidate URLs for a models listing, most specific first. */
export function modelListCandidates(baseUrl: string): string[] {
  const cleaned = cleanBaseUrl(baseUrl)
  if (!cleaned) return []
  if (cleaned.endsWith('/models')) return [cleaned]
  if (cleaned.endsWith('/v1')) return [`${cleaned}/models`, `${cleaned.replace(/\/v1$/, '')}/models`]
  return [`${cleaned}/v1/models`, `${cleaned}/models`]
}

function extractModels(payload: unknown): AvailableModel[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []

  const models: AvailableModel[] = []
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as { id?: unknown; owned_by?: unknown }
    if (typeof record.id === 'string' && record.id.trim()) {
      models.push({
        id: record.id,
        ownedBy: typeof record.owned_by === 'string' ? record.owned_by : undefined,
      })
    }
  }
  return models
}

/**
 * Fetch the list of models a custom endpoint exposes. Returns an empty array
 * when the endpoint cannot be probed or does not publish a models list.
 * Requests are intentionally scoped: no prompt or health data is ever sent.
 */
export async function fetchAvailableModels(
  baseUrl: string,
  apiKey?: string,
  fetchImpl: FetchLike = providerFetch,
): Promise<AvailableModel[]> {
  const urls = modelListCandidates(baseUrl)
  if (urls.length === 0) return []

  const headers: Record<string, string> = { accept: 'application/json' }
  const key = apiKey?.trim()
  if (key) headers.authorization = `Bearer ${key}`

  for (const url of urls) {
    try {
      const response = await fetchImpl(url, { method: 'GET', headers })
      if (!response.ok) continue
      const models = extractModels(await response.json())
      if (models.length) return models
    } catch {
      // Try the next candidate path; a single failure should not abort discovery.
    }
  }
  return []
}
