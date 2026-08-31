import { useLiveQuery } from 'dexie-react-hooks'
import { articleBySlug } from '../content/articles'
import { db } from '../db/schema'
import { localToday } from '../lib/dates'
import { useDialog } from '../context/DialogContext'

export function ArticleScreen({ slug, onClose }: { slug: string; onClose: () => void }) {
  const dialog = useDialog()
  const staticArticle = articleBySlug(slug)
  const dynamicArticle = useLiveQuery(() => db.generatedArticles.get(slug), [slug])
  const saved = useLiveQuery(() => db.contentBookmarks.get(slug), [slug])

  const article = staticArticle ?? dynamicArticle
  if (!article) return null

  const isAiGenerated = 'source' in article && article.source === 'ai'

  async function toggleSave() {
    if (saved) await db.contentBookmarks.delete(slug)
    else await db.contentBookmarks.put({ slug, savedAt: localToday() })
  }

  async function deleteArticle() {
    const confirmed = await dialog.confirm({
      title: 'Delete AI Insight',
      message: 'Are you sure you want to remove this generated insight from your library?',
      confirmText: 'Delete',
      isDanger: true,
    })
    if (confirmed) {
      await db.generatedArticles.delete(slug)
      await db.contentBookmarks.delete(slug)
      onClose()
    }
  }

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="back-btn" onClick={onClose} aria-label="Back">
          ‹
        </button>
        <h2>{article.category}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAiGenerated && (
            <button
              className="back-btn"
              onClick={() => void deleteArticle()}
              aria-label="Delete article"
              title="Delete this generated insight"
              style={{ fontSize: 16, color: 'var(--on-surface)' }}
            >
              🗑
            </button>
          )}
          <button
            className="back-btn"
            onClick={toggleSave}
            aria-label="Save"
            style={{ fontSize: 18, color: saved ? 'var(--primary)' : 'var(--on-surface)' }}
          >
            {saved ? '★' : '☆'}
          </button>
        </div>
      </div>
      <div className="overlay-body">
        {isAiGenerated && (
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--on-primary)',
                background: 'var(--primary)',
                border: '1px solid var(--primary)',
                padding: '5px 12px',
                borderRadius: 999,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              ✨ AI Generated Insight
            </span>
          </div>
        )}
        <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{article.title}</h1>
        <p className="muted" style={{ margin: '8px 0 20px' }}>
          {article.minutes} min read
        </p>
        {article.body.map((p, i) => (
          <p key={i} style={{ lineHeight: 1.6, marginBottom: 16, fontSize: 16 }}>
            {p}
          </p>
        ))}

        {'references' in article && Array.isArray(article.references) && article.references.length > 0 && (
          <section
            className="article-references"
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <h3
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--primary)',
                marginBottom: 12,
                fontWeight: 800,
              }}
            >
              Sources & Research Backlinks
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {article.references.map((ref, idx) => (
                <a
                  key={idx}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--card-bg, var(--surface-container))',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--on-surface)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    gap: 12,
                    boxShadow: 'var(--shadow-card)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--on-surface)', lineHeight: 1.35 }}>{ref.title}</span>
                    {ref.source && (
                      <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                        {ref.source}
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--primary)', fontSize: 16, flexShrink: 0 }}>↗</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="muted" style={{ marginTop: 20 }}>
          Educational content only — not medical advice. Talk to a clinician about your health.
        </p>
      </div>
    </div>
  )
}
