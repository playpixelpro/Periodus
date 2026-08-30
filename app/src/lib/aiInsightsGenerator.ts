import {
  askAssistant,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_CUSTOM_MODEL,
  DEFAULT_OPENAI_MODEL,
  type AssistantConfig,
  type AssistantProvider,
} from './assistant'
import { db, getSetting, SK, type GeneratedArticle, type Goal } from '../db/schema'
import { localToday } from './dates'
import { getSecureSecret, SECURE_SECRET_KEYS } from '../native/secureVault'

export async function getActiveAssistantConfig(): Promise<AssistantConfig | null> {
  const [providerRaw, modelRaw, baseUrlRaw] = await Promise.all([
    getSetting(SK.aiProvider),
    getSetting(SK.aiModel),
    getSetting(SK.aiBaseUrl),
  ])
  const provider = (providerRaw === 'openai' ? 'openai' : providerRaw === 'custom' ? 'custom' : 'anthropic') as AssistantProvider
  const keyName =
    provider === 'openai'
      ? SECURE_SECRET_KEYS.openAiApiKey
      : provider === 'custom'
        ? SECURE_SECRET_KEYS.customAiApiKey
        : SECURE_SECRET_KEYS.anthropicApiKey
  const apiKey = (await getSecureSecret(keyName)) ?? undefined
  if (!apiKey) return null

  const model =
    modelRaw ||
    (provider === 'openai'
      ? DEFAULT_OPENAI_MODEL
      : provider === 'custom'
        ? DEFAULT_CUSTOM_MODEL
        : DEFAULT_ANTHROPIC_MODEL)

  return {
    provider,
    apiKey,
    model,
    baseUrl: baseUrlRaw || undefined,
  }
}

export interface InsightTopicOption {
  goal: Goal
  category: string
  topic: string
}

export const SUGGESTED_INSIGHT_TOPICS: InsightTopicOption[] = [
  // Cycle
  {
    goal: 'cycle',
    category: 'Cycle basics',
    topic: 'Magnesium and Vitamin B6 for luteal phase mood and nervous system support',
  },
  {
    goal: 'cycle',
    category: 'Cycle basics',
    topic: 'Metabolism across the cycle: Why appetite and calorie needs fluctuate in the luteal phase',
  },
  {
    goal: 'cycle',
    category: 'Cycle basics',
    topic: 'Cycle-syncing movement: What sports medicine and physiology studies show',
  },
  {
    goal: 'cycle',
    category: 'Symptoms',
    topic: 'Digestive changes around menstruation: The role of prostaglandins on the gut',
  },
  // Fertility / TTC
  {
    goal: 'ttc',
    category: 'Fertility',
    topic: 'Cervical mucus staging and identifying the peak fertile window',
  },
  {
    goal: 'ttc',
    category: 'Fertility',
    topic: 'CoQ10 and mitochondrial energy in reproductive cell health',
  },
  {
    goal: 'ttc',
    category: 'Fertility',
    topic: 'Basal body temperature biphasic curves: Interpreting coverlines and shifts',
  },
  // Pregnancy
  {
    goal: 'pregnancy',
    category: 'Pregnancy',
    topic: 'First trimester fatigue: The biological energy cost of placenta formation',
  },
  {
    goal: 'pregnancy',
    category: 'Pregnancy',
    topic: 'Evidence-backed prenatal micronutrients: Choline, methylfolate, and DHA',
  },
  {
    goal: 'pregnancy',
    category: 'Pregnancy',
    topic: 'Pelvic floor health and gentle core stability throughout pregnancy',
  },
  // Perimenopause
  {
    goal: 'peri',
    category: 'Perimenopause',
    topic: 'The neuroscience of hot flashes and thermoregulation during estrogen fluctuations',
  },
  {
    goal: 'peri',
    category: 'Perimenopause',
    topic: 'Sleep architecture in perimenopause: Why progesterone drops affect deep sleep',
  },
  {
    goal: 'peri',
    category: 'Perimenopause',
    topic: 'Preserving lean muscle and bone density: Strength training during the transition',
  },
]

export function getTopicsForGoal(goal: Goal): InsightTopicOption[] {
  return SUGGESTED_INSIGHT_TOPICS.filter((t) => t.goal === goal)
}

export function pickRandomTopic(goal: Goal): InsightTopicOption {
  const matching = getTopicsForGoal(goal)
  if (matching.length === 0) return SUGGESTED_INSIGHT_TOPICS[0]
  const index = Math.floor(Math.random() * matching.length)
  return matching[index]
}

export function parseAiArticleResponse(
  rawText: string,
  fallbackCategory = 'Cycle basics',
  fallbackTopic = 'Women’s Health Insight',
): { title: string; category: string; minutes: number; body: string[] } {
  // Strip markdown code fences if present
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }

  // Attempt JSON parse
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    if (parsed && typeof parsed.title === 'string' && Array.isArray(parsed.body)) {
      const body = parsed.body
        .map((p) => String(p).trim())
        .filter((p) => p.length > 0)

      if (body.length > 0) {
        return {
          title: parsed.title.trim(),
          category: typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : fallbackCategory,
          minutes: typeof parsed.minutes === 'number' && parsed.minutes > 0 ? Math.min(Math.max(1, Math.round(parsed.minutes)), 10) : 2,
          body,
        }
      }
    }
  } catch {
    // JSON parse failed, proceed to heuristic text fallback
  }

  // Fallback heuristic: split into paragraphs
  const paragraphs = rawText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('{') && !p.startsWith('}'))

  const title = paragraphs[0]?.replace(/^#+\s*/, '').slice(0, 100) || fallbackTopic
  const body = paragraphs.length > 1 ? paragraphs.slice(1) : [rawText.trim()]

  return {
    title,
    category: fallbackCategory,
    minutes: Math.max(1, Math.round(body.join(' ').split(/\s+/).length / 180)),
    body,
  }
}

export async function generateAndSaveAiInsight(
  config: AssistantConfig,
  options: {
    goal?: Goal
    topic?: string
    category?: string
  } = {},
): Promise<GeneratedArticle> {
  const goal = options.goal ?? 'cycle'
  const defaultOption = pickRandomTopic(goal)
  const topic = options.topic ?? defaultOption.topic
  const category = options.category ?? defaultOption.category

  const prompt = `Write a calm, evidence-based educational article for a women's health app about the following topic:
Topic: "${topic}"
Target audience context: ${goal.toUpperCase()} focus.

You MUST respond strictly with a valid JSON object matching this schema without preamble:
{
  "title": "Clear, engaging, non-sensational article title (max 80 chars)",
  "category": "${category}",
  "minutes": 2,
  "body": [
    "First paragraph explaining the underlying biology or physiology in clear, accessible words.",
    "Second paragraph explaining practical lifestyle, nutrition, or supportive measures supported by research.",
    "Third paragraph summarizing how logging symptoms helps identify individual patterns, with a brief reminder that this is general education."
  ]
}

Safety requirements:
- Use calibrated language ("often", "may", "can").
- General education only, never diagnostic.
- Do not advise stopping or starting prescription medications.
- Output ONLY the raw JSON object.`

  const responseText = await askAssistant(
    config,
    [{ role: 'user', content: prompt }],
    { topic, goal },
  )

  const parsed = parseAiArticleResponse(responseText, category, topic)

  const slug = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const article: GeneratedArticle = {
    slug,
    title: parsed.title,
    category: parsed.category,
    minutes: parsed.minutes,
    body: parsed.body,
    source: 'ai',
    promptTopic: topic,
    createdAt: localToday(),
  }

  await db.generatedArticles.put(article)
  return article
}
