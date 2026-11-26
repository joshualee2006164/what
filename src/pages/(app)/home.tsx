import { useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useQuery, useUser } from 'deepspace'
import { ArrowLeft, ArrowRight, ExternalLink, LockKeyhole, X } from 'lucide-react'
import { AuthOverlay } from 'deepspace'
import { callWhatAction } from '../../lib/what-api'
import { isDiscoveryStory, pickUnseenStory } from '../../lib/story-selection'
import { findStoryVote } from '../../lib/story-votes'
import { opinionForVote } from '../../lib/opinion-versions'
import { getAiDisplayName } from '../../lib/ai-personas'
import { aiPerspectiveUpvoteId, humanPerspectiveUpvoteId } from '../../lib/discussion-upvotes'
import { usePerspectiveUpvotes } from '../../lib/use-perspective-upvotes'
import { StoryModalDiscussionRoot } from '../../components/StoryModal'
import PerspectiveOrbit, { type OrbitPerspective } from '../../components/PerspectiveOrbit'
import PerspectiveAvatar from '../../components/PerspectiveAvatar'
import PerspectiveUpvoteButton from '../../components/PerspectiveUpvoteButton'

type Story = {
  headline: string; summary: string; bubbleSummary: string; category: string
  sourceUrls: string[]; sourceNames: string[]; sourceTitles?: string[]; sourcePublishedAt?: string[]; publishedAt: string; generatedAt: string
  discussionQuestion: string; opinionA: string; opinionB: string; disclosure: string; presentationVersion?: string
  opinionVersion?: string; opinionHistory?: { version: string; opinionA: string; opinionB: string }[]
  perspectivesA?: string[]; perspectivesB?: string[]; perspectivesVersion?: string
}
type Vote = { storyId: string; userId: string; opinionId: 'a' | 'b' | 'undecided'; opinionVersion?: string }
type Comment = {
  storyId: string; authorId: string; authorName: string; opinionId: 'a' | 'b'
  text: string; opinionVersion?: string; parentCommentId?: string; postedAt: string
}
type RecordRow<T> = { recordId: string; data: T; createdBy: string; createdAt: string }

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function timeLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'W'
}

export default function HomePage(props: { embedded?: boolean; onClose?: () => void; onDiscussionState?: (storyId: string, active: boolean) => void }) {
  const [searchParams] = useSearchParams()
  const storyId = searchParams.get('story')
  const stories = useQuery<Story>('stories', { orderBy: 'generatedAt', orderDir: 'desc', limit: 5000 })
  const votes = useQuery<Vote>('votes', { limit: 5000 })
  const comments = useQuery<Comment>('comments', { orderBy: 'postedAt', orderDir: 'desc', limit: 5000 })
  return <HomePageForStory key={storyId ?? 'no-story'} {...props} storyRows={stories} voteRows={votes} commentRows={comments} />
}

function HomePageForStory({ embedded = false, onClose, onDiscussionState, storyRows: stories, voteRows: votes, commentRows: comments }: {
  embedded?: boolean
  onClose?: () => void
  onDiscussionState?: (storyId: string, active: boolean) => void
  storyRows: ReturnType<typeof useQuery<Story>>
  voteRows: ReturnType<typeof useQuery<Vote>>
  commentRows: ReturnType<typeof useQuery<Comment>>
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isSignedIn, userId } = useAuth()
  const { user } = useUser()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [proposalA, setProposalA] = useState('')
  const [proposalB, setProposalB] = useState('')
  const [proposalNotice, setProposalNotice] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [commentComposerOpen, setCommentComposerOpen] = useState(false)
  const [confirmedVote, setConfirmedVote] = useState<{ storyId: string; opinionId: Vote['opinionId'] } | null>(null)
  const [voteUnlocked, setVoteUnlocked] = useState(false)
  const [voteAnimating, setVoteAnimating] = useState(false)
  const [generatedPerspectives, setGeneratedPerspectives] = useState<{ storyId: string; perspectivesA: string[]; perspectivesB: string[] } | null>(null)
  const [perspectiveLoading, setPerspectiveLoading] = useState(false)
  const [perspectiveError, setPerspectiveError] = useState('')
  const [selectedAiPerspective, setSelectedAiPerspective] = useState('')
  const [selectedAiAuthor, setSelectedAiAuthor] = useState('')
  const [selectedAiPosition, setSelectedAiPosition] = useState<'a' | 'b'>('a')
  const [perspectiveRetry, setPerspectiveRetry] = useState(0)
  const requestedPerspectiveStories = useRef(new Set<string>())
  const voteRequestInProgress = useRef(false)
  const orbitRoot = useContext(StoryModalDiscussionRoot)

  const storyId = searchParams.get('story')
  const storyRecord = stories.records.find((record) => record.recordId === storyId)
  const story = storyRecord?.data
  const ownVoteRecord = votes.records.find((record) => record.data.storyId === storyId && record.data.userId === userId)
  const ownVote = confirmedVote?.storyId === storyId ? confirmedVote.opinionId
    : ownVoteRecord?.data.opinionId ?? findStoryVote(votes.records.map((record) => record.data), storyId, userId)
  const storyComments = useMemo(() => comments.records.filter((record) => record.data.storyId === storyId), [comments.records, storyId])
  const discussionRoots = storyComments.filter((comment) => !comment.data.parentCommentId)
  const focusedRoot = discussionRoots.find((record) => record.recordId === replyTo)
  const focusedReplies = focusedRoot ? storyComments.filter((reply) => reply.data.parentCommentId === focusedRoot.recordId) : []
  const sideA = story?.opinionA ?? 'Opinion A'
  const sideB = story?.opinionB ?? 'Opinion B'
  const isDecided = ownVote === 'a' || ownVote === 'b'
  const voteLocked = isDecided && !voteUnlocked
  const discoverableStories = useMemo(() => stories.records.filter((record) => isDiscoveryStory(record.data)), [stories.records])
  const savedPerspectivePair = generatedPerspectives?.storyId === storyId ? generatedPerspectives : undefined
  const hasCachedPerspectives = Boolean(savedPerspectivePair) || (story?.perspectivesVersion === '2' && (story.perspectivesA?.length ?? 0) === 3 && (story.perspectivesB?.length ?? 0) === 3)
  const perspectivesA = savedPerspectivePair?.perspectivesA ?? story?.perspectivesA
  const perspectivesB = savedPerspectivePair?.perspectivesB ?? story?.perspectivesB
  const perspectivesForSide = (side: 'a' | 'b') => {
    const human = discussionRoots.filter((record) => record.data.opinionId === side).slice(0, 3)
    const ai = (side === 'a' ? perspectivesA : perspectivesB) ?? []
    return [
      ...human.map((record) => ({ kind: 'human' as const, record })),
      ...ai.slice(0, Math.max(0, 3 - human.length)).map((text, index) => ({ kind: 'ai' as const, text, index })),
    ]
  }
  const enoughHumanPerspectives = (['a', 'b'] as const).every((side) =>
    discussionRoots.filter((record) => record.data.opinionId === side).length >= 3)
  const sideAPerspectives = perspectivesForSide('a')
  const sideBPerspectives = perspectivesForSide('b')
  const allPerspectives: OrbitPerspective[] = Array.from({ length: 3 }, (_, index) => {
    const makeEntry = (item: (typeof sideAPerspectives)[number] | undefined, side: 'a' | 'b'): OrbitPerspective | undefined => {
      if (!item) return undefined
      if (item.kind === 'human') {
        return {
          key: `human:${item.record.recordId}`,
          side,
          kind: 'human',
          authorName: item.record.data.authorName,
          avatarSeed: `reader:${item.record.data.authorId}`,
          text: item.record.data.text,
          recordId: item.record.recordId,
          upvoteId: humanPerspectiveUpvoteId(item.record.recordId),
        }
      }
      return {
        key: `ai:${storyId}:${side}:${item.index}`,
        side,
        kind: 'ai',
        authorName: getAiDisplayName(storyId ?? '', side, item.index),
        avatarSeed: `ai:${getAiDisplayName(storyId ?? '', side, item.index)}`,
        text: item.text,
        upvoteId: aiPerspectiveUpvoteId(storyId ?? '', side, item.index, item.text),
      }
    }
    return [makeEntry(sideAPerspectives[index], 'a'), makeEntry(sideBPerspectives[index], 'b')]
  }).flatMap((entries) => entries.filter((entry): entry is OrbitPerspective => !!entry))
  const upvoteRevision = [
    `${discussionRoots.length}:${discussionRoots[0]?.recordId ?? ''}`,
    ...(perspectivesA ?? []).map((text, index) => aiPerspectiveUpvoteId(storyId ?? '', 'a', index, text)),
    ...(perspectivesB ?? []).map((text, index) => aiPerspectiveUpvoteId(storyId ?? '', 'b', index, text)),
  ].join('\u0000')
  const perspectiveUpvotes = usePerspectiveUpvotes(storyId ?? '', isSignedIn, upvoteRevision)

  const discussionPortal = embedded && orbitRoot && !focusedRoot && !selectedAiPerspective ? createPortal(
    <>
      <PerspectiveOrbit
        items={allPerspectives}
        storyId={storyId ?? ''}
        isSignedIn={isSignedIn}
        onRequestSignIn={() => setShowAuth(true)}
        upvotes={perspectiveUpvotes}
        onOpenHuman={(recordId) => { setCommentText(''); setReplyTo(recordId) }}
        onOpenAi={(item) => {
          setReplyTo(null)
          setSelectedAiAuthor(item.authorName)
          setSelectedAiPosition(item.side)
          setSelectedAiPerspective(item.text)
          setCommentText('')
          setCommentComposerOpen(false)
        }}
      />
      {sideAPerspectives.length + sideBPerspectives.length < 4 && <p className="orbit-empty" role="status">{perspectiveLoading || comments.status === 'loading' ? 'Gathering a few perspectives…' : perspectiveError ? <>{perspectiveError} {isSignedIn && <button type="button" onClick={() => { if (storyId) requestedPerspectiveStories.current.delete(storyId); setPerspectiveError(''); setPerspectiveRetry((retry) => retry + 1) }}>Try again</button>}</> : comments.status === 'error' ? 'Reader comments could not load. Cached AI perspectives may still be available.' : !isSignedIn && !hasCachedPerspectives ? 'Sign in to prepare perspectives for this story.' : 'No perspectives are available yet.'}</p>}
    </>, orbitRoot,
  ) : null

  useEffect(() => {
    if (!storyId || !story || !isSignedIn || !['ready', 'error'].includes(comments.status) || hasCachedPerspectives || enoughHumanPerspectives || requestedPerspectiveStories.current.has(storyId)) return
    let active = true
    const requestStoryId = storyId
    requestedPerspectiveStories.current.add(requestStoryId)
    setPerspectiveLoading(true)
    setPerspectiveError('')
    void callWhatAction<{ perspectivesA: string[]; perspectivesB: string[] }>('ensure-perspectives', { storyId: requestStoryId })
      .then((result) => {
        if (!active) return
        if (result.success) setGeneratedPerspectives({ storyId: requestStoryId, ...result.data })
        else setPerspectiveError(result.code === 'perspectives_in_progress'
          ? 'AI perspectives are still being prepared. Please try again in a few minutes.'
          : 'AI perspectives are unavailable right now. Your vote is saved.')
      })
      .catch(() => { if (active) setPerspectiveError('AI perspectives are unavailable right now. Your vote is saved.') })
      .finally(() => { if (active) setPerspectiveLoading(false) })
    return () => { active = false }
  }, [storyId, story, isSignedIn, comments.status, hasCachedPerspectives, enoughHumanPerspectives, perspectiveRetry])

  useEffect(() => {
    onDiscussionState?.(storyId ?? '', Boolean(storyId))
    return () => onDiscussionState?.(storyId ?? '', false)
  }, [storyId, onDiscussionState])

  useEffect(() => {
    if (!storyId && discoverableStories.length) {
      const seen = new Set<string>()
      try { for (const id of JSON.parse(sessionStorage.getItem('what.seen') ?? '[]')) if (typeof id === 'string') seen.add(id) } catch { /* ignore an invalid local session marker */ }
      const next = pickUnseenStory(discoverableStories, seen)
      if (next.resetSeen) { try { sessionStorage.setItem('what.seen', '[]') } catch { /* session tracking is optional */ } }
      if (next.story) setSearchParams({ story: next.story.recordId }, { replace: true })
    }
  }, [storyId, discoverableStories, setSearchParams])

  useEffect(() => {
    setContextOpen(false)
    setProposalOpen(false)
    if (storyId) {
      try {
        const seen = new Set<string>(JSON.parse(sessionStorage.getItem('what.seen') ?? '[]'))
        seen.add(storyId)
        sessionStorage.setItem('what.seen', JSON.stringify([...seen]))
      } catch { /* browsing still works when storage is unavailable */ }
    }
  }, [storyId])

  useEffect(() => {
    if (!voteAnimating) return
    const timer = window.setTimeout(() => setVoteAnimating(false), 700)
    return () => window.clearTimeout(timer)
  }, [voteAnimating])

  function nextStory() {
    const seen = new Set<string>()
    try { for (const id of JSON.parse(sessionStorage.getItem('what.seen') ?? '[]')) if (typeof id === 'string') seen.add(id) } catch { /* ignore */ }
    const selection = pickUnseenStory(discoverableStories, seen, storyId ?? undefined)
    if (!selection.story) { onClose?.(); navigate('/'); return }
    if (selection.resetSeen) { try { sessionStorage.setItem('what.seen', '[]') } catch { /* session tracking is optional */ } }
    setError('')
    setCommentText('')
    setReplyTo(null)
    setSearchParams({ story: selection.story.recordId })
  }

  async function submitVote(opinionId: Vote['opinionId']) {
    if (!isSignedIn) { setShowAuth(true); return }
    if (!storyId || voteRequestInProgress.current || (voteLocked && ownVote !== opinionId)) return
    voteRequestInProgress.current = true
    const requestStoryId = storyId
    setBusy(true); setError('')
    try {
      const result = await callWhatAction('vote', { storyId: requestStoryId, opinionId })
      if (result.success) {
        setConfirmedVote({ storyId: requestStoryId, opinionId })
        setVoteUnlocked(false)
        setVoteAnimating(true)
      }
      else setError(result.error)
    } catch {
      setError('Your choice could not be saved. Please try again.')
    } finally {
      voteRequestInProgress.current = false
      setBusy(false)
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault()
    if (!isSignedIn) { setShowAuth(true); return }
    if (!storyId || !ownVote || ownVote === 'undecided') {
      setError('Choose a position before adding a comment.')
      return
    }
    setBusy(true); setError('')
    const result = await callWhatAction('comment', {
      storyId,
      opinionId: ownVote,
      text: commentText,
      ...(replyTo ? { parentCommentId: replyTo } : {}),
    })
    setBusy(false)
    if (!result.success) setError(result.error)
    else { setCommentText(''); setReplyTo(null) }
  }

  async function submitProposal(event: FormEvent) {
    event.preventDefault()
    if (!isSignedIn) { setShowAuth(true); return }
    if (!storyId) return
    setBusy(true); setProposalNotice('')
    const result = await callWhatAction('propose-opinions', { storyId, opinionA: proposalA, opinionB: proposalB })
    setBusy(false)
    if (!result.success) setProposalNotice(result.error)
    else {
      setProposalNotice('Thanks — your suggestion is saved for review.')
      setProposalA(''); setProposalB(''); setProposalOpen(false)
    }
  }

  if (stories.status === 'loading' || (storyId && isSignedIn && (!userId || votes.status === 'loading'))) {
    return <div className={`story-loading ${embedded ? 'story-loading--modal' : ''}`} aria-label="Loading story"><div className="loading-orbit" /><p>Gathering a little perspective…</p></div>
  }

  if (storyId && isSignedIn && votes.status === 'error') {
    return <section className={`empty-stories ${embedded ? 'empty-stories--modal' : ''}`} role="alert">
      <p className="eyebrow">Checking your answer</p><h1>Your saved choice couldn’t load.</h1>
      <p>Try again before answering, so we don’t ask you to vote twice.</p>
      <button className="pill-button pill-button--dark" onClick={() => window.location.reload()}>Try again</button>
      {embedded && <button className="text-link" onClick={() => onClose?.()}>Back to the globe</button>}
    </section>
  }

  if (!storyId || !story) {
    const noEligibleStories = stories.records.length > 0 && discoverableStories.length === 0
    return (
      <section className={`empty-stories ${embedded ? 'empty-stories--modal' : ''}`}>
        <div className="empty-orbit">what<span>.</span></div>
        <p className="eyebrow">The world is still turning</p>
        <h1>{stories.status === 'error' ? 'Stories are out of reach.' : noEligibleStories ? 'No discussion-ready stories.' : 'No stories just yet.'}</h1>
        <p>{stories.status === 'error' ? 'We couldn’t reach the saved stories. Try again in a moment.' : noEligibleStories ? 'The saved stories are kept intact while routine results and announcements stay out of discovery.' : 'There aren’t any saved news stories to explore yet.'}</p>
        {stories.status === 'error' ? <button className="pill-button pill-button--dark" onClick={() => window.location.reload()}>Try again</button> : user?.role === 'admin' && <Link className="pill-button pill-button--dark" to="/news-admin">Open news desk</Link>}
        <Link className="text-link" to="/">Back to the globe</Link>
      </section>
    )
  }

  const PageContainer = embedded ? 'div' : 'main'

  return (
    <>
    <PageContainer className={`story-page ${embedded ? 'story-page--modal' : ''}`}>
      <div className="story-topline">
        <button className="back-button" data-modal-close={embedded ? '' : undefined} onClick={() => embedded ? onClose?.() : navigate('/')} aria-label={embedded ? 'Close story' : 'Back to globe'}>{embedded ? <X size={17} /> : <ArrowLeft size={17} />}</button>
        {!embedded && <Link to="/" className="mini-wordmark">what<span>.</span></Link>}
        <span className="story-counter" aria-hidden="true" />
        <span className="topline-spacer" />
      </div>

      <article className="story-article" key={storyId}>
        <section className={`opinion-section ${ownVote ? 'opinion-section--answered' : ''}`}>
          <h1 className="prompt-question">{story.discussionQuestion}</h1>
          <div className="opinion-grid" role="group" aria-label="Choose your opinion">
            <button type="button" className={`opinion-card opinion-card--a ${ownVote === 'a' ? 'opinion-card--selected' : ''} ${voteLocked && ownVote !== 'a' ? 'opinion-card--muted' : ''} ${voteAnimating && ownVote === 'a' ? 'opinion-card--just-locked' : ''}`} onClick={() => submitVote('a')} disabled={busy || voteLocked} aria-pressed={ownVote === 'a'} aria-label={`${ownVote === 'a' ? voteLocked ? 'Locked in' : 'Selected' : 'Choose'} position A: ${sideA}`}>
              <span className="opinion-card__side">Position A</span>
              <span className="opinion-card__text">{sideA}</span>
              {voteLocked && ownVote === 'a' && <span className="opinion-card__selected" aria-hidden="true"><LockKeyhole size={13} /></span>}
            </button>
            <button type="button" className={`opinion-card opinion-card--b ${ownVote === 'b' ? 'opinion-card--selected' : ''} ${voteLocked && ownVote !== 'b' ? 'opinion-card--muted' : ''} ${voteAnimating && ownVote === 'b' ? 'opinion-card--just-locked' : ''}`} onClick={() => submitVote('b')} disabled={busy || voteLocked} aria-pressed={ownVote === 'b'} aria-label={`${ownVote === 'b' ? voteLocked ? 'Locked in' : 'Selected' : 'Choose'} position B: ${sideB}`}>
              <span className="opinion-card__side">Position B</span>
              <span className="opinion-card__text">{sideB}</span>
              {voteLocked && ownVote === 'b' && <span className="opinion-card__selected" aria-hidden="true"><LockKeyhole size={13} /></span>}
            </button>
          </div>
          {voteLocked && <div className="vote-confirmation">
            <p role="status">Your opinion is locked in</p>
            {!voteUnlocked && <button type="button" onClick={() => { setVoteUnlocked(true); setVoteAnimating(false) }} disabled={busy}>Change my answer</button>}
          </div>}
        </section>

        <button className="context-toggle" aria-expanded={contextOpen} onClick={() => setContextOpen((open) => !open)}>
          {contextOpen ? 'Hide the context' : 'What’s the context?'} <span aria-hidden>{contextOpen ? '−' : '+'}</span>
        </button>
        {contextOpen && <section className="context-panel">
          <p className="context-kicker">Original headline</p>
          <h2>{story.headline}</h2>
          <p className="context-summary">{story.summary}</p>
          <p className="context-date">Reported {dateLabel(story.publishedAt)} · Added {dateLabel(story.generatedAt)}</p>
          <p className="context-choices"><strong>Starting points</strong><br />A · {story.opinionA}<br />B · {story.opinionB}</p>
          <div className="context-sources">
            <p>Backed by {story.sourceUrls.length} {story.sourceUrls.length === 1 ? 'independent source' : 'independent sources'}</p>
            <ul>{story.sourceUrls.map((url, index) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">{story.sourceNames[index] || 'Publisher'} · {story.sourceTitles?.[index] || 'Open original article'} <ExternalLink size={12} /></a>
                {story.sourcePublishedAt?.[index] && <time>{dateLabel(story.sourcePublishedAt[index])}</time>}
              </li>
            ))}</ul>
          </div>
          <p className="ai-disclosure">{story.disclosure}</p>
          <button className="suggest-link" onClick={() => { if (!isSignedIn) setShowAuth(true); else setProposalOpen((open) => !open) }}>Suggest better opinions <span aria-hidden>↗</span></button>
          {proposalOpen && <form className="proposal-form" onSubmit={submitProposal}>
            <label>Alternative A<textarea value={proposalA} onChange={(event) => setProposalA(event.target.value)} maxLength={180} minLength={8} required placeholder="A fair way to see one side…" /></label>
            <label>Alternative B<textarea value={proposalB} onChange={(event) => setProposalB(event.target.value)} maxLength={180} minLength={8} required placeholder="And another fair way to see it…" /></label>
            <button className="pill-button pill-button--dark" disabled={busy}>Send suggestion</button>
          </form>}
          {proposalNotice && <p className="action-note" role="status">{proposalNotice}</p>}
        </section>}

        {focusedRoot ? <section className="discussion-focus" aria-label="Focused conversation">
          <button className="thread-back" onClick={() => { setReplyTo(null); setCommentText('') }}><ArrowLeft size={14} /> Back to perspectives</button>
          <article className={`comment-card comment-card--position-${focusedRoot.data.opinionId}`}>
            <div className="comment-author"><span className="comment-avatar">{initials(focusedRoot.data.authorName)}</span><strong>{focusedRoot.data.authorName}</strong><time>{timeLabel(focusedRoot.data.postedAt)}</time></div>
            <span className="perspective-position-label">{story ? opinionForVote(story, focusedRoot.data) : focusedRoot.data.opinionId === 'a' ? sideA : sideB}</span>
            <p>{focusedRoot.data.text}</p>
          </article>
          {focusedReplies.map((reply) => <article className="comment-card comment-card--reply" key={reply.recordId}>
            <div className="comment-author"><span className="comment-avatar">{initials(reply.data.authorName)}</span><strong>{reply.data.authorName}</strong><time>{timeLabel(reply.data.postedAt)}</time></div>
            <span className="perspective-position-label">{story ? opinionForVote(story, reply.data) : reply.data.opinionId === 'a' ? sideA : sideB}</span><p>{reply.data.text}</p>
          </article>)}
          {isSignedIn && isDecided ? <form className="comment-composer" onSubmit={submitComment}>
            <label htmlFor="reply-text">Reply with curiosity</label><textarea id="reply-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={500} required placeholder="Add a thoughtful response…" />
            <div className="composer-footer"><span>{commentText.length}/500 · as {user?.name || 'Reader'}</span><button className="pill-button pill-button--dark" disabled={busy || !commentText.trim()}>{busy ? 'Posting…' : 'Reply'} <ArrowRight size={15} /></button></div>
          </form> : isSignedIn ? <p className="discussion-gate">Choose either position to reply.</p> : <button className="pill-button pill-button--soft" onClick={() => setShowAuth(true)}>Sign in to reply</button>}
        </section> : <>
          {isSignedIn && isDecided && <button className="share-thought-toggle" onClick={() => setCommentComposerOpen((open) => !open)}>{commentComposerOpen ? 'Close thought box' : 'Add your perspective'}</button>}
          {commentComposerOpen && <form className="comment-composer comment-composer--compact" onSubmit={submitComment}>
            <label htmlFor="comment-text">Share a thought</label>
            <textarea id="comment-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={500} required placeholder="What makes you see it that way?" />
            <div className="composer-footer"><span>{commentText.length}/500</span><button className="pill-button pill-button--dark" disabled={busy || !commentText.trim()}>{busy ? 'Posting…' : 'Share'} <ArrowRight size={15} /></button></div>
          </form>}
          {!embedded && <section className="discussion-section"><h2>Here are both perspectives.</h2>
            {discussionRoots.length ? <div className="opposing-bubbles">{discussionRoots.map((record, index) => <div key={record.recordId} className={`speech-bubble speech-bubble--${record.data.opinionId === 'a' ? 'mint' : 'rose'} opposing-bubble opposing-bubble--position-${record.data.opinionId}`}>
              <span className="speech-bubble__content">
                <span className="perspective-bubble__author-header"><PerspectiveAvatar seed={`reader:${record.data.authorId}`} /><span className="bubble-author"><strong>{record.data.authorName}</strong><time>{timeLabel(record.data.postedAt)}</time></span></span>
                <span className="perspective-bubble__text">{record.data.text}</span>
                <span className="perspective-bubble__footer">
                  <button type="button" className="perspective-bubble__action" onClick={() => setReplyTo(record.recordId)}>Open conversation <ArrowRight size={12} /></button>
                  {storyId && <PerspectiveUpvoteButton perspectiveId={humanPerspectiveUpvoteId(record.recordId)} isSignedIn={isSignedIn} onRequestSignIn={() => setShowAuth(true)} upvotes={perspectiveUpvotes} />}
                </span>
              </span>
              <span aria-hidden="true" className={`speech-bubble__tail speech-bubble__tail--${index % 2 ? 'bottom-right' : 'bottom-left'}`} />
            </div>)}</div> : <div className="discussion-empty"><p>No opposing perspectives yet.</p></div>}
          </section>}
        </>}

        {selectedAiPerspective && <section className={`discussion-focus ai-focused-perspective ai-focused-perspective--${selectedAiPosition}`} aria-label="AI-generated perspective">
          <button className="thread-back" onClick={() => { setSelectedAiPerspective(''); setSelectedAiAuthor(''); setCommentText(''); setCommentComposerOpen(false) }}><ArrowLeft size={14} /> Back to perspectives</button>
          <div className="ai-persona-header"><PerspectiveAvatar seed={`ai:${selectedAiAuthor}`} /><span className="ai-persona-label"><strong>{selectedAiAuthor} · AI says…</strong><small>AI-generated · not a reader</small></span></div>
          <p className="ai-focused-perspective__text">{selectedAiPerspective}</p>
          <p className="ai-not-a-person">This is an AI perspective, not a reader comment. Share your view on the story itself.</p>
          {isSignedIn && isDecided && <button className="share-thought-toggle" onClick={() => setCommentComposerOpen((open) => !open)}>{commentComposerOpen ? 'Close thought box' : 'Share your perspective'}</button>}
          {commentComposerOpen && <form className="comment-composer comment-composer--compact" onSubmit={submitComment}>
            <label htmlFor="ai-response-text">Your comment on this story</label>
            <textarea id="ai-response-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={500} required placeholder="Add your own perspective…" />
            <div className="composer-footer"><span>{commentText.length}/500</span><button className="pill-button pill-button--dark" disabled={busy || !commentText.trim()}>{busy ? 'Posting…' : 'Share'} <ArrowRight size={15} /></button></div>
          </form>}
        </section>}

        {error && <div className="inline-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}
      </article>

      <button className="quick-next" onClick={nextStory}>{ownVote ? 'Next story' : 'Skip'} <ArrowRight size={14} /></button>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </PageContainer>
      {discussionPortal}
    </>
  )
}

