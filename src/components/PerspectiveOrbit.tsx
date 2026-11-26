import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import PerspectiveAvatar from './PerspectiveAvatar'
import PerspectiveUpvoteButton from './PerspectiveUpvoteButton'
import type { PerspectiveUpvoteState } from '../lib/use-perspective-upvotes'

export type OrbitPerspective = {
  key: string
  upvoteId: string
  side: 'a' | 'b'
  kind: 'human' | 'ai'
  authorName: string
  avatarSeed?: string
  avatarUrl?: string
  text: string
  recordId?: string
}

type OrbitSlot = {
  id: number
  perspectiveKey: string
  position: number
  expiresAt: number
  remainingMs?: number
  exiting?: boolean
  exitAt?: number
  paused?: boolean
  holds: Array<'hover' | 'focus' | 'interaction'>
}

function choosePerspective(items: OrbitPerspective[], slots: OrbitSlot[], seen: Set<string>) {
  const activeKeys = new Set(slots.map((slot) => slot.perspectiveKey))
  let candidates = items.filter((item) => !activeKeys.has(item.key) && !seen.has(item.key))
  if (!candidates.length) {
    seen.clear()
    activeKeys.forEach((key) => seen.add(key))
    candidates = items.filter((item) => !activeKeys.has(item.key))
  }
  if (!candidates.length) return undefined

  const sideCounts = {
    a: slots.filter((slot) => items.find((item) => item.key === slot.perspectiveKey)?.side === 'a').length,
    b: slots.filter((slot) => items.find((item) => item.key === slot.perspectiveKey)?.side === 'b').length,
  }
  const leastShown = Math.min(sideCounts.a, sideCounts.b)
  const balanced = candidates.filter((item) => sideCounts[item.side] === leastShown)
  const pool = balanced.length ? balanced : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}

function tailForPosition(position: number) {
  return (['bottom-right', 'bottom-left', 'right', 'left', 'top-right', 'top-left'] as const)[position]
}

export default function PerspectiveOrbit({ items, storyId, isSignedIn, onRequestSignIn, upvotes, onOpenHuman, onOpenAi }: {
  items: OrbitPerspective[]
  storyId: string
  isSignedIn: boolean
  onRequestSignIn: () => void
  upvotes: PerspectiveUpvoteState
  onOpenHuman: (recordId: string) => void
  onOpenAi: (item: OrbitPerspective) => void
}) {
  const [slots, setSlots] = useState<OrbitSlot[]>([])
  const [maxVisible, setMaxVisible] = useState(5)
  const nextId = useRef(0)
  const seen = useRef(new Set<string>())
  const itemKeys = items.map((item) => item.key)
  const itemKey = itemKeys.join('\u0000')
  const itemsRef = useRef(items)

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)')
    const short = window.matchMedia('(max-height: 700px)')
    const update = () => setMaxVisible(mobile.matches ? short.matches ? 2 : 4 : 5)
    update()
    mobile.addEventListener('change', update)
    short.addEventListener('change', update)
    return () => {
      mobile.removeEventListener('change', update)
      short.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    setSlots((current) => current.slice(0, maxVisible).map((slot, position) => ({ ...slot, position })))
  }, [maxVisible])

  useEffect(() => {
    setSlots([])
    seen.current.clear()
    nextId.current = 0
  }, [storyId])

  useEffect(() => {
    const validKeys = new Set(itemKeys)
    setSlots((current) => current.filter((slot) => validKeys.has(slot.perspectiveKey)))
  }, [itemKey])

  useEffect(() => {
    const timers = slots.map((slot) => {
      if (slot.exiting) {
        return window.setTimeout(() => setSlots((current) => current.filter((item) => item.id !== slot.id)), Math.max(0, (slot.exitAt ?? Date.now()) + 360 - Date.now()))
      }
      if (slot.paused) return 0
      return window.setTimeout(() => {
        setSlots((current) => current.map((item) => item.id === slot.id ? { ...item, exiting: true, exitAt: Date.now() } : item))
      }, Math.max(0, slot.expiresAt - Date.now()))
    }).filter(Boolean)
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [slots])

  useEffect(() => {
    if (!items.length || slots.length >= maxVisible) return
    const timer = window.setTimeout(() => {
      const positions = Array.from({ length: maxVisible === 5 ? 6 : maxVisible }, (_, position) => position)
        .filter((position) => !slots.some((slot) => slot.position === position))
      const currentItems = itemsRef.current
      const perspective = choosePerspective(currentItems, slots, seen.current)
      if (!perspective || !positions.length) return
      const position = positions[Math.floor(Math.random() * positions.length)]
      const slot: OrbitSlot = {
        id: ++nextId.current,
        perspectiveKey: perspective.key,
        position,
        expiresAt: Date.now() + 10_000 + Math.random() * 6000,
        holds: [],
      }
      seen.current.add(perspective.key)
      setSlots((current) => current.length < maxVisible ? [...current, slot] : current)
    }, slots.length ? 3000 + Math.random() * 2000 : 1000 + Math.random() * 1000)
    return () => window.clearTimeout(timer)
  }, [itemKey, maxVisible, slots.length])

  function holdBubble(id: number, reason: 'hover' | 'focus' | 'interaction', hold: boolean) {
    setSlots((current) => current.map((slot) => {
      if (slot.id !== id || slot.exiting) return slot
      const holds = new Set(slot.holds)
      if (hold) holds.add(reason)
      else holds.delete(reason)
      const paused = holds.size > 0
      if (paused && !slot.paused) return { ...slot, holds: [...holds], paused, remainingMs: Math.max(0, slot.expiresAt - Date.now()) }
      if (!paused && slot.paused) return { ...slot, holds: [], paused: false, expiresAt: Date.now() + (slot.remainingMs ?? 0), remainingMs: undefined }
      return { ...slot, holds: [...holds] }
    }))
  }

  return <div className="discussion-orbit__items" aria-label="Arguments for both positions">
    {slots.map((slot) => {
      const item = items.find((candidate) => candidate.key === slot.perspectiveKey)
      if (!item) return null
      const label = item.kind === 'ai' ? `${item.authorName} · AI says…` : item.authorName
      return <div
        key={slot.id}
        role="group"
        aria-label={item.kind === 'ai' ? `AI-generated perspective by ${item.authorName} for position ${item.side.toUpperCase()}` : `${item.authorName}'s perspective for position ${item.side.toUpperCase()}`}
        className={`speech-bubble speech-bubble--${item.side === 'a' ? 'mint' : 'rose'} perspective-bubble perspective-bubble--anchor-${slot.position + 1} perspective-bubble--side-${item.side} perspective-bubble--${item.kind}${slot.exiting ? ' perspective-bubble--exiting' : ''}`}
        style={{ '--orbit-index': slot.position } as React.CSSProperties}
        onMouseEnter={() => holdBubble(slot.id, 'hover', true)}
        onMouseLeave={() => holdBubble(slot.id, 'hover', false)}
        onFocusCapture={() => holdBubble(slot.id, 'focus', true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) holdBubble(slot.id, 'focus', false)
        }}
      >
        <span className="speech-bubble__content">
          <span className="perspective-bubble__author-header">
            <PerspectiveAvatar seed={item.avatarSeed ?? `${item.kind}:${item.authorName}`} imageUrl={item.avatarUrl} />
            <span className={`bubble-author ${item.kind === 'ai' ? 'bubble-author--ai' : ''}`}>
              <strong>{label}</strong>
              {item.kind === 'ai' && <small className="ai-persona-disclosure">AI-generated · not a reader</small>}
            </span>
          </span>
          <span className="perspective-bubble__text">{item.text}</span>
          <span className="perspective-bubble__footer">
            <button type="button" className="perspective-bubble__action" onClick={() => item.kind === 'human' && item.recordId ? onOpenHuman(item.recordId) : onOpenAi(item)}>
              {item.kind === 'ai' ? 'Share your view' : 'Open conversation'} <ArrowRight size={12} />
            </button>
            <PerspectiveUpvoteButton
              perspectiveId={item.upvoteId}
              isSignedIn={isSignedIn}
              onRequestSignIn={onRequestSignIn}
              upvotes={upvotes}
              onToggle={() => {
                if (!upvotes.loaded || upvotes.loadError || upvotes.pendingIds.has(item.upvoteId) || upvotes.errors[item.upvoteId]) return
                holdBubble(slot.id, 'interaction', true)
                void upvotes.toggle(item.upvoteId).finally(() => holdBubble(slot.id, 'interaction', false))
              }}
            />
          </span>
        </span>
        <span aria-hidden="true" className={`speech-bubble__tail speech-bubble__tail--${tailForPosition(slot.position)}`} />
      </div>
    })}
  </div>
}
