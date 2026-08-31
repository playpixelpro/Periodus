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
  // Cycle basics
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
    category: 'Cycle basics',
    topic: 'Follicular vs Luteal phase: How estrogen and progesterone shape daily energy',
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
  {
    goal: 'ttc',
    category: 'Fertility',
    topic: 'Luteinizing Hormone (LH) surge timing and optimal conception window',
  },
  {
    goal: 'ttc',
    category: 'Fertility',
    topic: 'Male factor fertility essentials: Sperm motility, morphology, and antioxidant support',
  },
  // Symptoms
  {
    goal: 'cycle',
    category: 'Symptoms',
    topic: 'Digestive changes around menstruation: The role of prostaglandins on the gut',
  },
  {
    goal: 'cycle',
    category: 'Symptoms',
    topic: 'Hormonal headaches and migraines: The physiology of the pre-menstrual estrogen drop',
  },
  {
    goal: 'cycle',
    category: 'Symptoms',
    topic: 'Cyclical breast tenderness (Mastalgia): Mechanisms and gentle management strategies',
  },
  {
    goal: 'cycle',
    category: 'Symptoms',
    topic: 'Bloating and fluid retention across cycle phases: Sodium, aldosterone, and progesterone',
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
  {
    goal: 'pregnancy',
    category: 'Pregnancy',
    topic: 'Navigating gestational glucose metabolism and balanced meals in pregnancy',
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
  {
    goal: 'peri',
    category: 'Perimenopause',
    topic: 'Mood fluctuations and cognitive clarity in perimenopause: Brain estrogen receptor dynamics',
  },
  // Contraception
  {
    goal: 'cycle',
    category: 'Contraception',
    topic: 'Nutrient considerations on hormonal contraception: B vitamins, zinc, and magnesium',
  },
  {
    goal: 'cycle',
    category: 'Contraception',
    topic: 'Transitioning off hormonal birth control: Re-establishing natural hypothalamic-pituitary-ovarian rhythm',
  },
  // Sleep & energy
  {
    goal: 'cycle',
    category: 'Sleep & energy',
    topic: 'Circadian biology and hormonal health: How morning light impacts melatonin and cortisol',
  },
  {
    goal: 'cycle',
    category: 'Sleep & energy',
    topic: 'The temperature paradox: Core body temperature changes and sleep quality across cycle phases',
  },
  // Movement & nutrition
  {
    goal: 'cycle',
    category: 'Movement & nutrition',
    topic: 'Protein distribution and muscle protein synthesis across menstrual cycle phases',
  },
  {
    goal: 'cycle',
    category: 'Movement & nutrition',
    topic: 'Iron status, ferritin markers, and optimizing energy for menstruating individuals',
  },
  // Privacy & health data
  {
    goal: 'cycle',
    category: 'Privacy',
    topic: 'Local-first architecture and encryption: Why on-device health data protection matters',
  },
  {
    goal: 'cycle',
    category: 'Privacy',
    topic: 'Health data sovereignty: Understanding zero-knowledge storage for menstrual tracking',
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

export function pickTopicForCategory(category?: string | null, goal: Goal = 'cycle'): InsightTopicOption {
  if (!category || category === 'AI Insights') {
    return pickRandomTopic(goal)
  }

  const matching = SUGGESTED_INSIGHT_TOPICS.filter(
    (t) => t.category.toLowerCase() === category.toLowerCase(),
  )

  if (matching.length > 0) {
    const index = Math.floor(Math.random() * matching.length)
    return matching[index]
  }

  // Dynamic fallback for any custom category
  return {
    goal,
    category,
    topic: `Key clinical insights, physiology, and evidence-based guidance for ${category.toLowerCase()}`,
  }
}

export function getDefaultReferencesForCategory(category: string): { title: string; url: string; source: string }[] {
  const catLower = category.toLowerCase()
  if (catLower.includes('fertility') || catLower.includes('ttc')) {
    return [
      {
        title: 'American Society for Reproductive Medicine (ASRM) - Clinical Guidelines on Infertility & Ovulation',
        url: 'https://www.asrm.org/practice-guidance/practice-committee-documents/',
        source: 'ASRM',
      },
      {
        title: 'National Institutes of Health (NIH) - PubMed Reproductive Physiology Research',
        url: 'https://pubmed.ncbi.nlm.nih.gov/?term=cervical+mucus+ovulation+fertility+window',
        source: 'NIH / PubMed',
      },
      {
        title: 'ACOG Practice Bulletin - Optimizing Natural Fertility & Conception',
        url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/06/optimizing-natural-fertility',
        source: 'ACOG',
      },
    ]
  }

  if (catLower.includes('privacy') || catLower.includes('data')) {
    return [
      {
        title: 'Electronic Frontier Foundation (EFF) - Reproductive & Health Data Privacy Guidelines',
        url: 'https://www.eff.org/issues/reproductive-privacy',
        source: 'EFF',
      },
      {
        title: 'Federal Trade Commission (FTC) - Best Practices for Health Apps & Sensitive Data Privacy',
        url: 'https://www.ftc.gov/business-guidance/privacy-security/health-privacy',
        source: 'FTC',
      },
      {
        title: 'Center for Democracy & Technology (CDT) - Protecting Sensitive Health Data',
        url: 'https://cdt.org/insights/protecting-sensitive-health-data-in-a-post-roe-world/',
        source: 'CDT',
      },
    ]
  }

  if (catLower.includes('peri') || catLower.includes('menopause')) {
    return [
      {
        title: 'The Menopause Society - Clinical Guidelines on Perimenopause & Vasomotor Symptoms',
        url: 'https://www.menopause.org/for-professionals/clinical-care-recommendations',
        source: 'The Menopause Society',
      },
      {
        title: 'Endocrine Society - Clinical Practice Guidelines on Hormonal Changes in Perimenopause',
        url: 'https://www.endocrine.org/clinical-practice-guidelines',
        source: 'Endocrine Society',
      },
      {
        title: 'National Institutes of Health (NIH) - Menopause & Sleep Physiology Studies',
        url: 'https://pubmed.ncbi.nlm.nih.gov/?term=perimenopause+estrogen+thermoregulation+sleep',
        source: 'NIH / PubMed',
      },
    ]
  }

  if (catLower.includes('pregnancy')) {
    return [
      {
        title: 'American College of Obstetricians and Gynecologists (ACOG) - Prenatal Nutrition & Health Guidelines',
        url: 'https://www.acog.org/womens-health/faqs/nutrition-during-pregnancy',
        source: 'ACOG',
      },
      {
        title: 'CDC - Maternal and Infant Health Recommendations',
        url: 'https://www.cdc.gov/maternal-infant-health/index.html',
        source: 'CDC',
      },
      {
        title: 'National Institutes of Health (NIH) - Micronutrients in Pregnancy Research',
        url: 'https://pubmed.ncbi.nlm.nih.gov/?term=prenatal+micronutrients+choline+folate',
        source: 'NIH / PubMed',
      },
    ]
  }

  // Default cycle & women's health references
  return [
    {
      title: 'American College of Obstetricians and Gynecologists (ACOG) - Menstruation & Ovulatory Health',
      url: 'https://www.acog.org/womens-health/faqs/your-menstrual-cycle',
      source: 'ACOG',
    },
    {
      title: 'National Institutes of Health (NIH) - PubMed Women’s Health & Endocrinology Reviews',
      url: 'https://pubmed.ncbi.nlm.nih.gov/?term=menstrual+cycle+hormones+luteal+phase',
      source: 'NIH / PubMed',
    },
    {
      title: 'Endocrine Society - Physiology of the Reproductive System & Hormonal Rhythm',
      url: 'https://www.endocrine.org/patient-engagement/endocrine-library/reproductive-health',
      source: 'Endocrine Society',
    },
  ]
}

export function parseAiArticleResponse(
  rawText: string,
  fallbackCategory = 'Cycle basics',
  fallbackTopic = 'Women’s Health Insight',
): {
  title: string
  category: string
  minutes: number
  body: string[]
  references: { title: string; url: string; source?: string }[]
} {
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
        const category =
          typeof parsed.category === 'string' && parsed.category.trim()
            ? parsed.category.trim()
            : fallbackCategory

        let references: { title: string; url: string; source?: string }[] = []
        if (Array.isArray(parsed.references) && parsed.references.length > 0) {
          references = parsed.references
            .filter((r) => r && typeof r === 'object' && typeof (r as { title?: unknown }).title === 'string' && typeof (r as { url?: unknown }).url === 'string')
            .map((r) => {
              const refObj = r as { title: string; url: string; source?: string }
              return {
                title: String(refObj.title).trim(),
                url: String(refObj.url).trim(),
                source: refObj.source ? String(refObj.source).trim() : undefined,
              }
            })
        }

        if (references.length === 0) {
          references = getDefaultReferencesForCategory(category)
        }

        return {
          title: parsed.title.trim(),
          category,
          minutes:
            typeof parsed.minutes === 'number' && parsed.minutes > 0
              ? Math.min(Math.max(1, Math.round(parsed.minutes)), 10)
              : 2,
          body,
          references,
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
    references: getDefaultReferencesForCategory(fallbackCategory),
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
  const chosenTopic = options.topic
    ? { goal, category: options.category ?? 'Cycle basics', topic: options.topic }
    : pickTopicForCategory(options.category, goal)

  const topic = chosenTopic.topic
  const category = options.category ?? chosenTopic.category

  const prompt = `Write a calm, authoritative, evidence-based educational article for a women's health app focusing specifically on the "${category}" category.

Topic: "${topic}"
Target category: ${category}
Audience context: ${goal.toUpperCase()} focus.

You MUST respond strictly with a valid JSON object matching this schema without preamble or markdown wraps:
{
  "title": "Clear, engaging, non-sensational article title (max 80 chars)",
  "category": "${category}",
  "minutes": 2,
  "body": [
    "First paragraph explaining the underlying biology or physiology in clear, accessible words.",
    "Second paragraph explaining practical lifestyle, nutrition, or supportive measures supported by research.",
    "Third paragraph summarizing how logging symptoms helps identify individual patterns, with a brief reminder that this is general education."
  ],
  "references": [
    {
      "title": "Full name of published research paper, institutional study, or clinical guidelines (e.g. ACOG, PubMed, NIH, Endocrine Society, ASRM)",
      "url": "https://pubmed.ncbi.nlm.nih.gov/... or official institutional source URL",
      "source": "ACOG / NIH / ASRM / PubMed"
    },
    {
      "title": "Secondary clinical guidelines or peer-reviewed study title",
      "url": "https://pubmed.ncbi.nlm.nih.gov/...",
      "source": "PubMed / Endocrine Society"
    }
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
    { topic, goal, category },
  )

  const parsed = parseAiArticleResponse(responseText, category, topic)

  const slug = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const article: GeneratedArticle = {
    slug,
    title: parsed.title,
    category: parsed.category,
    minutes: parsed.minutes,
    body: parsed.body,
    references: parsed.references,
    source: 'ai',
    promptTopic: topic,
    createdAt: localToday(),
  }

  await db.generatedArticles.put(article)
  return article
}
