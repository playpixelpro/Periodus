import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ARTICLES, type Article } from '../content/articles'
import { db, getSetting, SK, type GeneratedArticle, type Goal } from '../db/schema'
import { useApp } from '../state/appStore'
import { useDialog } from '../context/DialogContext'
import {
  generateAndSaveAiInsight,
  getActiveAssistantConfig,
  pickTopicForCategory,
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

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

    const activeCategory = selectedCategory && selectedCategory !== 'AI Insights' ? selectedCategory : undefined
    const chosenOption = pickTopicForCategory(activeCategory, goal)

    const chosen = await dialog.confirm({
      title: activeCategory ? `Generate ${activeCategory} Insight` : 'Generate Fresh Insight',
      message: `Would you like Periodus AI to research and generate an evidence-backed educational guide${
        activeCategory ? ` in "${activeCategory}"` : ''
      } on:

"${chosenOption.topic}"?`,
      confirmText: 'Generate Guide',
      cancelText: 'Cancel',
    })

    if (!chosen) return

    setIsGenerating(true)
    setGeneratingTopic(chosenOption.topic)
    setStatusMessage(null)

    try {
      const generated = await generateAndSaveAiInsight(config, {
        goal,
        topic: chosenOption.topic,
        category: chosenOption.category,
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

  const categoryButtonLabel = isGenerating
    ? 'Generating fresh insight…'
    : selectedCategory && selectedCategory !== 'AI Insights'
      ? `Generate fresh ${selectedCategory} insight`
      : 'Generate fresh women’s health insight'

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

      <div className="insights-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.4 15.4 4.1 4.1" />
        </svg>
        <input
          type="search"
          aria-label="Search articles"
          placeholder="Search cycles, symptoms, fertility, privacy…"
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
              <button
                key={category}
                className={`category-chip${selectedCategory === category ? ' active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              >
                {category}
              </button>
            ))}
          </nav>

          {/* AI Category-Contextual Generate Insight Action */}
          <div style={{ margin: '8px 0 16px' }}>
            <button
              className="health-action"
              disabled={isGenerating}
              onClick={() => void handleGenerateInsight()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                padding: '13px 18px',
                background: 'var(--card-bg, var(--surface-container))',
                border: selectedCategory
                  ? '1.5px solid var(--primary)'
                  : '1px solid var(--border-subtle)',
                color: 'var(--on-surface)',
                borderRadius: 16,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: selectedCategory ? 'var(--shadow-float)' : 'var(--shadow-card)',
                cursor: isGenerating ? 'wait' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ color: 'var(--primary)', fontSize: 16 }}>{isGenerating ? '✦' : '✨'}</span>
              <span>{categoryButtonLabel}</span>
            </button>
            {generatingTopic && (
              <p
                className="muted"
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  margin: '8px 0 0',
                  fontStyle: 'italic',
                  color: 'var(--on-surface-variant)',
                  fontWeight: 500,
                }}
              >
                Researching sources for &ldquo;{generatingTopic}&rdquo;…
              </p>
            )}
            {statusMessage && (
              <p
                style={{
                  fontSize: 13,
                  textAlign: 'center',
                  margin: '8px 0 0',
                  color: 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                {statusMessage}
              </p>
            )}
          </div>
          <div className="insight-sections">
            {categories
              .filter((category) => !selectedCategory || category === selectedCategory)
              .map((category, categoryIndex) => {
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
