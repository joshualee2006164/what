import { ArrowUp } from 'lucide-react'
import type { PerspectiveUpvoteState } from '../lib/use-perspective-upvotes'

export default function PerspectiveUpvoteButton({ perspectiveId, isSignedIn, onRequestSignIn, upvotes, onToggle }: {
  perspectiveId: string
  isSignedIn: boolean
  onRequestSignIn: () => void
  upvotes: PerspectiveUpvoteState
  onToggle?: () => void
}) {
  const upvoted = upvotes.upvotedIds.includes(perspectiveId)
  const error = upvotes.errors[perspectiveId] || upvotes.loadError
  const loading = !upvotes.loaded
  const pending = upvotes.pendingIds.has(perspectiveId)

  function handleClick() {
    if (!isSignedIn) onRequestSignIn()
    else if (onToggle) onToggle()
    else void upvotes.toggle(perspectiveId)
  }

  return <span className="perspective-upvote">
    <button
      type="button"
      className={`perspective-upvote__button${upvoted ? ' perspective-upvote__button--active' : ''}`}
      aria-label={upvoted ? 'Remove your upvote' : 'Upvote this perspective'}
      aria-pressed={upvoted}
      aria-busy={pending}
      title={upvoted ? 'Remove your upvote' : 'Upvote this perspective'}
      disabled={loading || Boolean(error) || pending}
      onClick={handleClick}
    >
      <ArrowUp size={13} aria-hidden="true" />
    </button>
    <span className="perspective-upvote__count" aria-live="polite" title={error}>{error ? '—' : upvotes.counts[perspectiveId] ?? (loading ? '—' : 0)}</span>
    {error && <small className="perspective-upvote__error" role="status">{error}</small>}
  </span>
}
