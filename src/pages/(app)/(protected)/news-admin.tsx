import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useUser } from 'deepspace'
import NewsRefreshControl from '../../../components/NewsRefreshControl'
import { callWhatAction } from '../../../lib/what-api'
import { isDiscoveryStory } from '../../../lib/story-selection'
import { STORY_PRESENTATION_VERSION } from '../../../lib/news-generation'

type Story = { headline: string; summary: string; category: string; discussionQuestion: string; generatedAt: string; presentationVersion?: string; perspectivesA?: string[]; perspectivesB?: string[]; perspectivesVersion?: string }
type Vote = { storyId: string }

export default function NewsAdminPage() {
  const { user } = useUser()
  const stories = useQuery<Story>('stories', { orderBy: 'generatedAt', orderDir: 'desc', limit: 5000 })
  const votes = useQuery<Vote>('votes', { limit: 5000 })
  const discoverableCount = stories.records.filter((record) => isDiscoveryStory(record.data)).length
  const [updatingId, setUpdatingId] = useState('')
  const [operation, setOperation] = useState<'presentation' | 'perspectives' | null>(null)
  const [notice, setNotice] = useState('')

  async function refreshPresentation(storyId: string) {
    const hasVotes = votes.records.some((record) => record.data.storyId === storyId)
    if (!window.confirm(`This makes one OpenAI request for this story. It writes a self-contained question and shorter direct responses${hasVotes ? ', keeping old choices in their version history for existing voters' : ''}. Continue?`)) return
    setUpdatingId(storyId)
    setOperation('presentation')
    setNotice('')
    try {
      const result = await callWhatAction<{ discussionQuestion: string; versioned: boolean }>('refresh-story-presentation', { storyId })
      setNotice(result.success ? `Question and response wording updated${result.data.versioned ? '; existing votes retain their previous opinion version' : ''}.` : result.error)
    } catch { setNotice('The presentation update failed. The story was left unchanged.') }
    finally { setUpdatingId(''); setOperation(null) }
  }

  async function backfillPerspectives(storyId: string) {
    if (!window.confirm('This makes one OpenAI request for this story, grounded in its saved verified summary and source titles. It caches three arguments for each side. Continue?')) return
    setUpdatingId(storyId)
    setOperation('perspectives')
    setNotice('')
    try {
      const result = await callWhatAction<{ perspectivesA: string[]; perspectivesB: string[] }>('backfill-story-perspectives', { storyId })
      setNotice(result.success ? 'Six labeled AI perspectives are cached for this story.' : result.error)
    } catch { setNotice('Perspective generation failed. Try again; no story fields were replaced.') }
    finally { setUpdatingId(''); setOperation(null) }
  }

  if (user?.role !== 'admin') return <main className="news-admin-page"><section className="news-admin-panel">
    <p className="eyebrow">News desk</p><h1>Admin access required</h1><p>Only an app admin can refresh or review the shared story collection.</p>
    <Link className="pill-button pill-button--dark" to="/">Back to what.</Link>
  </section></main>

  return <main className="news-admin-page"><section className="news-admin-panel">
    <p className="eyebrow">what. · news desk</p><h1>Bring in the world</h1>
    <p>Refresh appends newly verified stories; it skips existing source URLs, hashes and covered events rather than regenerating saved records. It checks headlines from the US, UK, India, Australia and South Africa. Stories without enough independent reporting or complete required story fields are skipped; question and answer style preferences do not reject otherwise supported stories. Each refresh makes five NewsAPI requests and up to five or 20 Exa searches. OpenAI validates eligible stories in groups of four, so a five-candidate batch uses up to two requests and a 20-candidate batch up to five.</p>
    <p>Use <strong>Refresh up to 5 stories</strong> for a small batch or confirm <strong>Build a larger batch · 20</strong> to check up to 20 candidates. A run can save fewer than requested when source, deduplication or AI validation rejects candidates. After the eight-minute cooldown, another run can append more new stories. The larger batch asks before using DeepSpace credits.</p>
    <p className="news-admin-count">{stories.status === 'loading' ? 'Checking the shared collection…' : stories.status === 'error' ? 'The saved-story count could not be loaded.' : <>{stories.records.length} saved stories · {discoverableCount} ready for discovery · {stories.records.filter((record) => record.data.presentationVersion !== STORY_PRESENTATION_VERSION).length} need a question update · {stories.records.filter((record) => record.data.perspectivesVersion !== '2' || (record.data.perspectivesA?.length ?? 0) !== 3 || (record.data.perspectivesB?.length ?? 0) !== 3).length} need AI perspectives</>}</p>
    <NewsRefreshControl />
    <div className="news-admin-list"><h2>Recently saved</h2>
      {stories.status === 'loading' ? <p>Checking the shared collection…</p> : stories.records.length === 0 ? <p>No saved stories yet.</p> : <ul>
        {stories.records.slice(0, 20).map((record) => {
          const needsPresentation = record.data.presentationVersion !== STORY_PRESENTATION_VERSION
          const needsPerspectives = record.data.perspectivesVersion !== '2' || (record.data.perspectivesA?.length ?? 0) !== 3 || (record.data.perspectivesB?.length ?? 0) !== 3
          return <li key={record.recordId}>
            <span>{record.data.discussionQuestion || record.data.headline}<time>{new Date(record.data.generatedAt).toLocaleDateString()}</time></span>
            {needsPresentation && <button className="shorten-question" onClick={() => void refreshPresentation(record.recordId)} disabled={!!updatingId}>{updatingId === record.recordId && operation === 'presentation' ? 'Updating…' : 'Simplify question & answers'}</button>}
            {needsPerspectives && <button className="shorten-question" onClick={() => void backfillPerspectives(record.recordId)} disabled={!!updatingId}>{updatingId === record.recordId && operation === 'perspectives' ? 'Preparing…' : 'Cache AI perspectives'}</button>}
          </li>
        })}
        {stories.records.length > 20 && <p>Showing the 20 newest stories. Each action above updates one story at a time.</p>}
      </ul>}
      {notice && <p className="news-admin-notice" role="status">{notice}</p>}
    </div>
    <Link className="news-admin-back" to="/">Back to the globe</Link>
  </section></main>
}
