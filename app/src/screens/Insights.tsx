import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ARTICLES, type Article } from '../content/articles'
import { db, getSetting, SK, type GeneratedArticle, type Goal } from '../db/schema'
import { useApp } from '../state/appStore'
import { useDialog } from '../context/DialogContext'
import {
  generateAndSaveAiInsight,
  getActiveAssistantConfig,
  pickRandomTopic,
} from '../lib/aiInsightsGenerator'

const GOAL_CATEGORY: Record<Goal, string> = {
  cycle: 'Cycle basics',
  ttc: 'Fertility',
  pregnancy: 'Pregnancy',
  peri: 'Perimenopause',
}

const CATEGORY_TONE: Record<string, string> = {
  'Cycle basics': 'rose',
  Symptoms: 'clay',
  Fertility: 'teal',
  Perimenopause: 'sun',
  Pregnancy: 'yellow',
  Privacy: 'mineral',
  'AI Insights': 'gold',
}

export function Insights() {
  const { setArticleSlug, setAssistantOpen } = useApp()
  const dialog = useDialog()
  const [query, setQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const [goal, bookmarks, customArticles] = await Promise.all([
      getSetting(SK.goal),
      db.contentBookmarks.toArray(),
      db.generatedArticles.toArray(),
    ])
    return {
      goal: (goal ?? 'cycle') as Goal,
      saved: new Set(bookmarks.map((bookmark) => bookmark.slug)),
      generated: customArticles,
    }
  }, [])

  const goal = data?.goal ?? 'cycle'
  const allArticles: (Article | GeneratedArticle)[] = [
    ...(data?.generated ?? []),
    ...ARTICLES,
  ]

  const featured = data ? GOAL_CATEGORY[data.goal] : 'Cycle basics'
  const categories = [...new Set(allArticles.map((article) => article.category))].sort((a, b) => {
    if (a === 'AI Insights') return -1
    if (b === 'AI Insights') return 1
    return a === featured ? -1 : b === featured ? 1 : 0
  })

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const searchResults = normalizedQuery
    ? allArticles.filter((article) =>
        [article.title, article.category, ...article.body]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : []

  async function handleGenerateInsight() {
    const config = await getActiveAssistantConfig()
    if (!config) {
      const confirmOpen = await dialog.confirm({
        title: 'Configure AI Assistant',
        message: 'To generate custom women’s health insights, configure an AI provider (OpenAI, Anthropic, or Local Ollama) in Settings.',
        confirmText: 'Go to Assistant',
        cancelText: 'Cancel',
      })
      if (confirmOpen) {
        setAssistantOpen(true)
      }
      return
    }

    const randomDefault = pickRandomTopic(goal)

    const chosen = await dialog.confirm({
      title: 'Generate Fresh Insight',
      message: `Would you like Periodus AI to research and generate a fresh educational guide on:

"${randomDefault.topic}"?`,
      confirmText: 'Generate Guide',
      cancelText: 'Cancel',
    })

    if (!chosen) return

    setIsGenerating(true)
    setGeneratingTopic(randomDefault.topic)
    setStatusMessage(null)

    try {
      const generated = await generateAndSaveAiInsight(config, {
        goal,
        topic: randomDefault.topic,
        category: randomDefault.category,
      })
      setStatusMessage(`✨ Generated: "${generated.title}"`)
      setArticleSlug(generated.slug)
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : 'Could not generate insight.')
    } finally {
      setIsGenerating(false)
      setGeneratingTopic(null)
    }
  }

  return (
    <div className="page insights-page">
      <header className="page-title-block">
        <span className="page-kicker">Knowledge for your season</span>
        <h1>Read, ask, notice</h1>
        <p>Calm explanations for the questions that rarely fit into a search bar.</p>
      </header>

      <button className="assistant-feature" onClick={() => setAssistantOpen(true)}>
        <span className="assistant-constellation" aria-hidden="true">
          <i className="constellation-orbit orbit-a" />
          <i className="constellation-orbit orbit-b" />
          <i className="constellation-seed seed-a" />
          <i className="constellation-seed seed-b" />
          <i className="constellation-seed seed-c" />
        </span>
        <span className="assistant-feature-copy">
          <span className="assistant-feature-kicker">Periodus AI</span>
          <strong>Bring the question you keep circling</strong>
          <small>Your key, your conversation, your choice</small>
        </span>
        <span className="assistant-feature-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 12h13M13 7l5 5-5 5" />
          </svg>
        </span>
      </button>

      {/* AI Generate Fresh Insight Button */}
      <div style={{ margin: '14px 0 6px' }}>
        <button
          className="health-action"
          disabled={isGenerating}
          onClick={() => void handleGenerateInsight()}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'var(--surface-dark, #1F1B12)',
            border: '1px solid rgba(255, 225, 163, 0.4)',
            color: 'var(--gold, #FFE1A3)',
            borderRadius: 14,
            fontWeight: 600,
            fontSize: 14,
            cursor: isGenerating ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span>{isGenerating ? '✦' : '✨'}</span>
          <span>
            {isGenerating
              ? `Generating fresh insight…`
              : 'Generate fresh women’s health insight'}
          </span>
        </button>
        {generatingTopic && (
          <p
            className="muted"
            style={{
              fontSize: 12,
              textAlign: 'center',
              margin: '6px 0 0',
              fontStyle: 'italic',
            }}
          >
            Researching: &ldquo;{generatingTopic}&rdquo;
          </p>
        )}
        {statusMessage && (
          <p
            style={{
              fontSize: 13,
              textAlign: 'center',
              margin: '6px 0 0',
              color: 'var(--gold, #FFE1A3)',
            }}
          >
            {statusMessage}
          </p>
        )}
      </div>

      <div className="insights-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.4 15.4 4.1 4.1" />
        </svg>
        <input
          type="search"
          aria-label="Search articles"
          placeholder="Search cycles, symptoms, fertility…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear article search">
            ×
          </button>
        )}
      </div>

      {normalizedQuery ? (
        <section className="insight-section search-results" aria-live="polite">
          <div className="section-heading insight-section-heading">
            <div>
              <span className="section-overline">Library search</span>
              <h2>{searchResults.length ? `Results for “${query.trim()}”` : 'Nothing matched yet'}</h2>
            </div>
            <span className="collection-count">{searchResults.length}</span>
          </div>
          {searchResults.length ? (
            <div className="article-list">
              {searchResults.map((article, index) => {
                const isAi = 'source' in article && article.source === 'ai'
                return (
                  <button
                    key={article.slug}
                    className="article-card"
                    onClick={() => setArticleSlug(article.slug)}
                  >
                    <span className="article-visual" aria-hidden="true">
                      <i className="article-orbit" />
                      <i className="article-leaf leaf-one" />
                      <i className="article-leaf leaf-two" />
                      <b>{isAi ? '✦' : String(index + 1).padStart(2, '0')}</b>
                    </span>
                    <span className="article-copy">
                      <span className="article-meta">
                        {isAi && (
                          <span
                            style={{
                              color: 'var(--gold, #FFE1A3)',
                              fontWeight: 700,
                              marginRight: 6,
                            }}
                          >
                            ✨ AI ·
                          </span>
                        )}
                        {article.category} · {article.minutes} min read
                      </span>
                      <strong>{article.title}</strong>
                      <span className="article-open" aria-hidden="true">
                        Read <b>↗</b>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="card empty-card">
              Try a broader word, or ask Periodus AI without sharing tracker data.
            </div>
          )}
        </section>
      ) : (
        <>
          <nav className="category-ribbon" aria-label="Insight categories">
            {categories.map((category) => (
              <a key={category} href={`#category-${category.toLowerCase().replaceAll(' ', '-')}`}>
                {category}
              </a>
            ))}
          </nav>
          <div className="insight-sections">
            {categories.map((category, categoryIndex) => {
              const articles = allArticles.filter((article) => article.category === category)
              const tone = CATEGORY_TONE[category] ?? 'rose'
              return (
                <section
                  key={category}
                  className={`insight-section tone-${tone}`}
                  id={`category-${category.toLowerCase().replaceAll(' ', '-')}`}
                >
                  <div className="section-heading insight-section-heading">
                    <div>
                      <span className="section-overline">
                        {categoryIndex === 0 ? 'Chosen for your focus' : `Collection 0${categoryIndex + 1}`}
                      </span>
                      <h2>{category}</h2>
                    </div>
                    <span className="collection-count">{articles.length}</span>
                  </div>

                  <div className="article-list">
                    {articles.map((article, index) => {
                      const isAi = 'source' in article && article.source === 'ai'
                      return (
                        <button
                          key={article.slug}
                          className={`article-card${categoryIndex === 0 && index === 0 ? ' article-featured' : ''}`}
                          onClick={() => setArticleSlug(article.slug)}
                        >
                          <span className="article-visual" aria-hidden="true">
                            <i className="article-orbit" />
                            <i className="article-leaf leaf-one" />
                            <i className="article-leaf leaf-two" />
                            <b>{isAi ? '✦' : String(index + 1).padStart(2, '0')}</b>
                          </span>
                          <span className="article-copy">
                            <span className="article-meta">
                              {isAi && (
                                <span
                                  style={{
                                    color: 'var(--gold, #FFE1A3)',
                                    fontWeight: 700,
                                    marginRight: 6,
                                  }}
                                >
                                  ✨ AI Curated ·
                                </span>
                              )}
                              {article.minutes} min read
                              {data?.saved.has(article.slug) && (
                                <span className="saved-label">
                                  <span aria-hidden="true">◆</span> Saved
                                </span>
                              )}
                            </span>
                            <strong>{article.title}</strong>
                            <span className="article-open" aria-hidden="true">
                              Read <b>↗</b>
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
