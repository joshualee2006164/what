import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ArrowRight, RefreshCw } from 'lucide-react'
import Globe from '../../components/Globe'
import StoryModal from '../../components/StoryModal'
import HomePage from './home'
import { Seo } from '../../components/Seo'
import { seo } from '../../seo'
import { isDiscoveryStory, pickUnseenStory } from '../../lib/story-selection'
import BrandedLoading from '../../components/BrandedLoading'
import { Link } from 'react-router-dom'
import type { ActivityComment } from '../../lib/discussion-activity'

type Story = { discussionQuestion: string; headline: string; summary: string }

export default function LandingPage() {
  const stories = useQuery<Story>('stories', { orderBy: 'generatedAt', orderDir: 'desc', limit: 5000 })
  const comments = useQuery<ActivityComment>('comments', { limit: 5000 })
  const { user } = useUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [landingMessage, setLandingMessage] = useState('')
  const [modalClosing, setModalClosing] = useState(false)
  const [discussionState, setDiscussionState] = useState<{ storyId: string; active: boolean }>({ storyId: '', active: false })
  const handleDiscussionState = useCallback((storyId: string, active: boolean) => setDiscussionState({ storyId, active }), [])
  const available = stories.records.filter((record) => isDiscoveryStory(record.data))
  const isAdmin = user?.role === 'admin'
  const selectedStoryId = searchParams.get('story')

  function explore(storyId?: string) {
    if (!available.length) {
      setLandingMessage(stories.records.length
        ? 'There are no stories ready for discovery right now. The saved collection is kept intact.'
        : isAdmin ? 'There are no saved stories yet. Open the news desk to refresh reporting.' : 'Stories have not been added yet. An app admin needs to run the first refresh.')
      return
    }
    if (storyId) {
      setSearchParams({ story: storyId })
      return
    }
    const seen = new Set<string>()
    try { for (const id of JSON.parse(sessionStorage.getItem('what.seen') ?? '[]')) if (typeof id === 'string') seen.add(id) } catch { /* session tracking is optional */ }
    const picked = pickUnseenStory(available, seen)
    if (picked.resetSeen) { try { sessionStorage.setItem('what.seen', '[]') } catch { /* session tracking is optional */ } }
    if (picked.story) setSearchParams({ story: picked.story.recordId })
  }

  const closeStory = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('story')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const requestCloseStory = useCallback(() => setModalClosing(true), [])
  useEffect(() => {
    if (!modalClosing) return
    const timer = window.setTimeout(() => {
      closeStory()
      setModalClosing(false)
    }, 260)
    return () => window.clearTimeout(timer)
  }, [modalClosing, closeStory])

  if (stories.status === 'loading') return <><Seo {...seo} title="what. — A little news. A little perspective." description="Meet the stories shaping today, choose what you think, and hear a different point of view." path="/" /><BrandedLoading /></>

  return (
    <section data-testid="what-landing" className={`landing-page ${selectedStoryId ? discussionState.storyId === selectedStoryId && discussionState.active ? 'landing-page--discussion' : 'landing-page--question' : ''}`}>
      <Seo {...seo} title="what. — A little news. A little perspective." description="Meet the stories shaping today, choose what you think, and hear a different point of view." path="/" />
      <div className="landing-copy">
        <p className="eyebrow"><span className="brand-dot" /> A little news. A little perspective.</p>
        <h1>Everyone has an <em>opinion.</em></h1>
        <p className="landing-question">What&apos;s yours?</p>
      </div>

      <div className="landing-globe-wrap">
        <Globe stories={available} comments={comments.records.map((record) => record.data)} onExplore={explore} interacting={!!selectedStoryId} />
        {!available.length && (
          <p className="globe-empty-note">
            {stories.status === 'error' ? 'Couldn’t reach the saved stories.' : stories.records.length ? 'No discussion-ready stories right now.' : 'The world is ready for its first story.'}
          </p>
        )}
      </div>

      <div className="landing-bottom">
        <p className="landing-tap-copy">Tap the world to explore <ArrowRight size={15} /></p>
        {landingMessage && <p className="landing-hint" role="status">{landingMessage}</p>}
        {available.length ? null : stories.status === 'error' ? (
          <button className="pill-button pill-button--dark" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Try again
          </button>
        ) : isAdmin ? (
          <Link className="landing-admin-link" to="/news-admin">Open the news desk</Link>
        ) : (
          <p className="landing-hint">{stories.records.length ? 'More stories are being reviewed.' : 'An app admin will bring the first stories soon.'}</p>
        )}
        <p className="landing-footnote">Real reporting. Human perspective. A few minutes at a time.</p>
      </div>
      {selectedStoryId && <StoryModal onClose={requestCloseStory} closing={modalClosing}><HomePage embedded onClose={requestCloseStory} onDiscussionState={handleDiscussionState} /></StoryModal>}
    </section>
  )
}
