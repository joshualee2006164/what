import { useEffect, useRef, useState } from 'react'
import { callWhatAction, callWhatPublicAction } from './what-api'

type UpvoteStats = { counts: Record<string, number>; upvotedIds: string[] }

export type PerspectiveUpvoteState = {
  revision: string
  counts: Record<string, number>
  upvotedIds: string[]
  loaded: boolean
  loadError?: string
  pendingIds: Set<string>
  errors: Record<string, string>
  toggle: (perspectiveId: string) => Promise<void>
}

export function usePerspectiveUpvotes(storyId: string, isSignedIn: boolean, revision: string): PerspectiveUpvoteState {
  const [snapshot, setSnapshot] = useState<{ storyId: string; revision: string; counts: Record<string, number>; upvotedIds: string[]; loaded: boolean; loadError?: string }>({
    storyId: '',
    revision: '',
    counts: {},
    upvotedIds: [],
    loaded: false,
  })
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const requests = useRef(new Set<string>())
  const current = snapshot.storyId === storyId && snapshot.revision === revision
    ? snapshot
    : { storyId, revision, counts: {}, upvotedIds: [], loaded: false }

  useEffect(() => {
    if (!storyId) return
    let active = true
    setSnapshot({ storyId, revision, counts: {}, upvotedIds: [], loaded: false })
    setErrors({})
    void callWhatPublicAction<UpvoteStats>('perspective-upvote-stats', { storyId })
      .then((result) => {
        if (!active) return
        if (result.success) setSnapshot({ storyId, revision, ...result.data, loaded: true })
        else setSnapshot({ storyId, revision, counts: {}, upvotedIds: [], loaded: true, loadError: result.error })
      })
      .catch(() => {
        if (active) setSnapshot({ storyId, revision, counts: {}, upvotedIds: [], loaded: true, loadError: 'Upvotes could not be loaded.' })
      })
    return () => { active = false }
  }, [storyId, isSignedIn, revision])

  async function toggle(perspectiveId: string) {
    if (!isSignedIn || !current.loaded || current.loadError || requests.current.has(perspectiveId)) return
    const upvoted = current.upvotedIds.includes(perspectiveId)
    requests.current.add(perspectiveId)
    setPendingIds((previous) => new Set(previous).add(perspectiveId))
    setErrors((previous) => ({ ...previous, [perspectiveId]: '' }))
    try {
      const result = await callWhatAction<{ count: number; upvoted: boolean }>('set-perspective-upvote', {
        storyId,
        perspectiveId,
        upvoted: !upvoted,
      })
      if (!result.success) {
        setErrors((previous) => ({ ...previous, [perspectiveId]: result.error }))
        return
      }
      setSnapshot((previous) => previous.storyId !== storyId || previous.revision !== revision
        ? previous
        : {
          ...previous,
          counts: { ...previous.counts, [perspectiveId]: result.data.count },
          upvotedIds: result.data.upvoted
            ? [...new Set([...previous.upvotedIds, perspectiveId])]
            : previous.upvotedIds.filter((id) => id !== perspectiveId),
        })
    } catch {
      setErrors((previous) => ({ ...previous, [perspectiveId]: 'Your upvote could not be saved. Please try again.' }))
    } finally {
      requests.current.delete(perspectiveId)
      setPendingIds((previous) => {
        const next = new Set(previous)
        next.delete(perspectiveId)
        return next
      })
    }
  }

  return { ...current, pendingIds, errors, toggle }
}
