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
              style={{ fontSize: 14, color: 'var(--muted)' }}
            >
              🗑
            </button>
          )}
          <button className="back-btn" onClick={toggleSave} aria-label="Save">
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
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--gold, #FFE1A3)',
                background: 'rgba(255, 225, 163, 0.12)',
                border: '1px solid rgba(255, 225, 163, 0.3)',
                padding: '3px 8px',
                borderRadius: 999,
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
        <p className="muted" style={{ marginTop: 12 }}>
          Educational content only — not medical advice. Talk to a clinician about your health.
        </p>
      </div>
    </div>
  )
}
