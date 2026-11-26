import { useEffect, useMemo, useRef, useState } from 'react'
import SpeechBubble from './SpeechBubble'
import HotFlame from './HotFlame'
import { hasActiveDiscussion, type ActivityComment } from '../lib/discussion-activity'

type GlobeStory = { recordId: string; data: { discussionQuestion: string; headline: string; summary: string } }
const turnMs = 30_000
const cityNames = ['San Francisco', 'New York', 'Mexico City', 'São Paulo', 'London', 'Paris', 'Cairo', 'Nairobi', 'Dubai', 'Mumbai', 'Singapore', 'Seoul', 'Tokyo', 'Sydney']

type BubbleHold = 'hover' | 'focus'
type BubbleSlot = {
  id: number
  storyId: string
  position: number
  tone: 'cream' | 'mint' | 'ocean' | 'peach' | 'lavender' | 'honey' | 'rose'
  expiresAt: number
  remainingMs?: number
  exiting?: boolean
  exitAt?: number
  paused?: boolean
  holds: BubbleHold[]
}

const bubbleTones: BubbleSlot['tone'][] = ['honey', 'lavender', 'mint', 'peach', 'cream', 'ocean', 'rose']

type BuildingKind = 'house' | 'apartment' | 'tower' | 'rounded' | 'spire'
type BuildingSpec = { x: number; width: number; height: number; color: string; kind: BuildingKind; windows: number }

const cityPalettes = [
  ['#C97965', '#E9B18F', '#A79BC6', '#71859A', '#E5D6B8', '#A9A09A', '#E5A8AD', '#D6AF55', '#486C54'],
  ['#D69378', '#B4A7C9', '#7F91A5', '#E9C9A8', '#9E9B91', '#D6A75F', '#6C876D'],
  ['#C98270', '#F0BA9B', '#9386B5', '#76899B', '#F2E0C3', '#B7A89D', '#D98F9A', '#C7A04E'],
  ['#D08970', '#AFA4C5', '#7892A2', '#E5C5A7', '#9B9A91', '#D0A251', '#55775F'],
] as const

const cityLayouts: BuildingSpec[][] = [
  [
    { x: -27, width: 10, height: 9, color: '#C97965', kind: 'house', windows: 1 },
    { x: -15, width: 11, height: 14, color: '#E9B18F', kind: 'apartment', windows: 2 },
    { x: -2, width: 12, height: 24, color: '#71859A', kind: 'tower', windows: 3 },
    { x: 12, width: 11, height: 13, color: '#A79BC6', kind: 'house', windows: 1 },
    { x: 25, width: 10, height: 19, color: '#D6AF55', kind: 'spire', windows: 2 },
  ],
  [
    { x: -23, width: 16, height: 10, color: '#E9B18F', kind: 'house', windows: 1 },
    { x: -3, width: 17, height: 13, color: '#E5D6B8', kind: 'house', windows: 1 },
    { x: 18, width: 13, height: 9, color: '#E5A8AD', kind: 'house', windows: 1 },
  ],
  [
    { x: -25, width: 11, height: 17, color: '#76899B', kind: 'apartment', windows: 2 },
    { x: -11, width: 12, height: 32, color: '#B4A7C9', kind: 'spire', windows: 2 },
    { x: 4, width: 12, height: 25, color: '#C97965', kind: 'tower', windows: 3 },
    { x: 20, width: 10, height: 15, color: '#D6A75F', kind: 'rounded', windows: 2 },
  ],
  [
    { x: -26, width: 12, height: 13, color: '#E5D6B8', kind: 'house', windows: 1 },
    { x: -11, width: 15, height: 18, color: '#A9A09A', kind: 'apartment', windows: 2 },
    { x: 8, width: 11, height: 11, color: '#D98F9A', kind: 'house', windows: 1 },
    { x: 22, width: 12, height: 15, color: '#486C54', kind: 'rounded', windows: 2 },
  ],
  [
    { x: -29, width: 10, height: 8, color: '#F0BA9B', kind: 'house', windows: 1 },
    { x: -16, width: 12, height: 16, color: '#71859A', kind: 'apartment', windows: 2 },
    { x: -1, width: 17, height: 28, color: '#C98270', kind: 'spire', windows: 3 },
    { x: 19, width: 13, height: 12, color: '#9386B5', kind: 'house', windows: 1 },
  ],
  [
    { x: -22, width: 14, height: 21, color: '#7892A2', kind: 'rounded', windows: 2 },
    { x: -5, width: 12, height: 13, color: '#D0A251', kind: 'house', windows: 1 },
    { x: 10, width: 18, height: 17, color: '#E5C5A7', kind: 'apartment', windows: 3 },
  ],
  [
    { x: -30, width: 12, height: 12, color: '#D08970', kind: 'house', windows: 1 },
    { x: -15, width: 12, height: 17, color: '#AFA4C5', kind: 'apartment', windows: 2 },
    { x: 0, width: 12, height: 11, color: '#55775F', kind: 'house', windows: 1 },
    { x: 15, width: 16, height: 24, color: '#7892A2', kind: 'tower', windows: 3 },
  ],
]

function MiniBuilding({ building }: { building: BuildingSpec }) {
  const { x, width, height, color, kind, windows } = building
  const roof = kind === 'house'
    ? <path d={`M${x - 1} ${-height + 1}  ${x + width / 2} ${-height - 5} ${x + width + 1} ${-height + 1}Z`} fill={color} />
    : kind === 'spire'
      ? <path d={`M${x} ${-height + 2} ${x + width / 2} ${-height - 7} ${x + width} ${-height + 2}Z`} fill={color} />
      : null
  const top = kind === 'rounded'
    ? <path d={`M${x} ${-height + width / 2} a${width / 2} ${width / 2} 0 0 1 ${width} 0`} fill={color} />
    : null
  const bodyY = kind === 'house' ? -height + 1 : -height
  const bodyHeight = kind === 'house' ? height - 1 : height
  const columns = kind === 'house' ? 1 : Math.max(1, Math.min(3, windows))
  const rows = kind === 'house' ? 1 : Math.max(2, Math.floor(height / 6))
  return <g>
    <rect x={x} y={bodyY} width={width} height={bodyHeight} rx={kind === 'rounded' ? width / 2 : kind === 'tower' ? 2 : 1} fill={color} />
    {roof}{top}
    {Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
      const gap = width / (columns + 1)
      const windowWidth = Math.min(1.7, gap * .42)
      return <rect key={`${row}-${column}`} x={x + gap * (column + 1) - windowWidth / 2} y={-height + 3 + row * 4.5} width={windowWidth} height="1.5" rx=".45" fill="#FFF0B8" opacity=".92" />
    }))}
    {kind === 'house' && <rect x={x + width * .42} y={-5} width={width * .2} height="5" rx=".5" fill="#765C4B" />}
    {kind === 'spire' && <path d={`M${x + width / 2} ${-height - 7}v-5`} stroke="#D6AF55" strokeWidth="1" />}
  </g>
}

function CityTree({ x, size, color }: { x: number; size: number; color: string }) {
  return <g transform={`translate(${x} 0)`}>
    <path d={`M0 0v-${size * .55}`} stroke="#725F4E" strokeWidth="1.5" />
    <circle cy={-size * .72} r={size * .44} fill={color} />
    <circle cx={-size * .23} cy={-size * .67} r={size * .32} fill="#91AE70" />
  </g>
}

function CitySkyline({ name, index, count }: { name: string; index: number; count: number }) {
  const angle = (index / count) * 360
  const radians = angle * Math.PI / 180
  const radius = 130
  const x = 180 + Math.sin(radians) * radius
  const y = 180 - Math.cos(radians) * radius
  const buildings = cityLayouts[index % cityLayouts.length]
  const palette = cityPalettes[index % cityPalettes.length]
  const park = index === 3 || index === 8 || index === 12
  const scale = index === 1 || index === 8 ? .78 : index === 5 || index === 9 ? 1.12 : 1
  return <g className="globe-city" transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`} aria-hidden="true" data-city={name} data-city-variant={park ? 'park' : `skyline-${index % cityLayouts.length}`}>
    <ellipse cx="0" cy="1.4" rx="35" ry="3.5" fill="#234B37" opacity=".18" />
    <path d="M-36 1h72" stroke="#234B37" strokeOpacity=".42" strokeWidth="1.5" strokeLinecap="round" />
    {park && <path d="M-8 0h19" stroke="#78905A" strokeWidth="4" strokeLinecap="round" opacity=".6" />}
    {buildings.map((building, buildingIndex) => <MiniBuilding key={`${name}-${buildingIndex}`} building={building} />)}
    <CityTree x={-34} size={7 + index % 3} color={palette[index % palette.length]} />
    <CityTree x={36} size={6 + (index + 1) % 4} color={palette[(index + 3) % palette.length]} />
  </g>
}

export default function Globe({ stories, comments = [], onExplore, interacting = false }: { stories: GlobeStory[]; comments?: ActivityComment[]; onExplore: (storyId?: string) => void; interacting?: boolean }) {
  const [slots, setSlots] = useState<BubbleSlot[]>([])
  const [rotation, setRotation] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [maxBubbles, setMaxBubbles] = useState(6)
  const storyIds = useMemo(() => stories.map((story) => story.recordId), [stories])
  const storyKey = storyIds.join('\u0000')
  const storyIdList = useMemo(() => storyKey ? storyKey.split('\u0000') : [], [storyKey])
  const storyById = useMemo(() => new Map(stories.map((story) => [story.recordId, story])), [stories])
  const shown = useRef(new Set<string>())
  const nextSlotId = useRef(0)
  const interactionPausedAt = useRef<number | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setMaxBubbles(media.matches ? 4 : 6)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setSlots((current) => current.slice(0, maxBubbles).map((slot, position) => ({ ...slot, position })))
  }, [maxBubbles])

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => setRotation((angle) => (angle + 360 * 33 / turnMs) % 360), 33)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  useEffect(() => {
    shown.current.clear()
    nextSlotId.current = 0
    setSlots([])
  }, [storyKey])

  useEffect(() => {
    if (interacting) {
      interactionPausedAt.current ??= Date.now()
      return
    }
    if (interactionPausedAt.current === null) return
    const pausedDuration = Date.now() - interactionPausedAt.current
    interactionPausedAt.current = null
    setSlots((current) => current.map((slot) => slot.paused || slot.exiting ? slot : { ...slot, expiresAt: slot.expiresAt + pausedDuration }))
  }, [interacting])

  useEffect(() => {
    const timers = slots.map((slot) => {
      if (slot.exiting) {
        return window.setTimeout(() => setSlots((current) => current.filter((item) => item.id !== slot.id)), Math.max(0, (slot.exitAt ?? Date.now()) + 360 - Date.now()))
      }
      if (slot.paused || interacting) return 0
      return window.setTimeout(() => {
        setSlots((current) => current.map((item) => item.id === slot.id ? { ...item, exiting: true, exitAt: Date.now() } : item))
      }, Math.max(0, slot.expiresAt - Date.now()))
    }).filter(Boolean)
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [slots, interacting])

  useEffect(() => {
    if (interacting || !storyIdList.length || slots.length >= maxBubbles) return
    const timer = window.setTimeout(() => {
      const activeStories = new Set(slots.map((slot) => slot.storyId))
      let candidates = storyIdList.filter((storyId) => !activeStories.has(storyId) && !shown.current.has(storyId))
      if (!candidates.length) {
        shown.current = new Set(activeStories)
        candidates = storyIdList.filter((storyId) => !activeStories.has(storyId))
      }
      const availablePositions = Array.from({ length: maxBubbles }, (_, position) => position)
        .filter((position) => !slots.some((slot) => slot.position === position))
      if (!candidates.length || !availablePositions.length) return
      const storyId = candidates[Math.floor(Math.random() * candidates.length)]
      const position = availablePositions[Math.floor(Math.random() * availablePositions.length)]
      const now = Date.now()
      const slot: BubbleSlot = {
        id: ++nextSlotId.current,
        storyId,
        position,
        tone: bubbleTones[Math.floor(Math.random() * bubbleTones.length)],
        expiresAt: now + 7000 + Math.random() * 5000,
        holds: [],
      }
      shown.current.add(storyId)
      setSlots((current) => current.length < maxBubbles ? [...current, slot] : current)
    }, 1000 + Math.random() * 1000)
    return () => window.clearTimeout(timer)
  }, [interacting, storyIdList, slots.length, maxBubbles])

  function holdBubble(id: number, reason: BubbleHold, hold: boolean) {
    setSlots((current) => current.map((slot) => {
      if (slot.id !== id || slot.exiting) return slot
      const holds = new Set(slot.holds)
      if (hold) holds.add(reason)
      else holds.delete(reason)
      const paused = holds.size > 0
      if (paused && !slot.paused) return { ...slot, holds: [...holds], paused, remainingMs: Math.max(0, slot.expiresAt - Date.now()) }
      if (!paused && slot.paused) {
        return { ...slot, holds: [], paused: false, expiresAt: Date.now() + (slot.remainingMs ?? 0), remainingMs: undefined }
      }
      return { ...slot, holds: [...holds] }
    }))
  }

  return (
    <div className="globe-scene">
      {slots.map((slot) => {
        const story = storyById.get(slot.storyId)
        if (!story) return null
        const hot = hasActiveDiscussion(comments, story.recordId, `${story.data.headline} ${story.data.summary}`)
        return <SpeechBubble tail={slot.position % 2 ? 'bottom-right' : 'bottom-left'} tone={slot.tone} type="button" className={`globe-bubble globe-bubble--slot-${slot.position + 1} ${slot.exiting ? 'globe-bubble--exiting' : ''}`} style={{ '--bubble-index': slot.position } as React.CSSProperties} data-story-id={story.recordId} data-bubble-id={slot.id} key={slot.id} onMouseEnter={() => holdBubble(slot.id, 'hover', true)} onMouseLeave={() => holdBubble(slot.id, 'hover', false)} onFocus={() => holdBubble(slot.id, 'focus', true)} onBlur={() => holdBubble(slot.id, 'focus', false)} onClick={() => onExplore(story.recordId)} aria-label={`Open story question${hot ? ' with active discussion' : ''}: ${story.data.discussionQuestion}`}>
          {hot && <HotFlame className="hot-flame--bubble" />}
          {story.data.discussionQuestion}
        </SpeechBubble>
      })}
      <button type="button" className="globe-stage" onClick={() => onExplore()} aria-label="Tap the rotating globe to explore an unseen news story">
        <svg className="globe-art" viewBox="0 0 360 360" role="img" aria-label="A softly illustrated rotating Earth with city markers">
          <defs>
            <clipPath id="earth-clip"><circle cx="180" cy="180" r="132" /></clipPath>
            <radialGradient id="ocean" cx="34%" cy="25%" r="86%">
              <stop offset="0" stopColor="#8ECBD4" /><stop offset=".63" stopColor="#56A7B8" /><stop offset="1" stopColor="#2C7C9C" />
            </radialGradient>
            <radialGradient id="earth-glow" cx="32%" cy="22%" r="84%">
              <stop offset="0" stopColor="#FFFFF5" stopOpacity=".35" /><stop offset=".56" stopColor="#FFFFF5" stopOpacity=".06" /><stop offset="1" stopColor="#234B37" stopOpacity=".12" />
            </radialGradient>
            <linearGradient id="land" x1="0" y1="0" x2=".8" y2="1">
              <stop stopColor="#A6D85A" /><stop offset="1" stopColor="#76A52D" />
            </linearGradient>
            <radialGradient id="limb-fade"><stop offset="79%" stopColor="white" /><stop offset="95%" stopColor="white" stopOpacity=".4" /><stop offset="100%" stopColor="black" /></radialGradient>
            <mask id="earth-limb-mask"><circle cx="180" cy="180" r="132" fill="url(#limb-fade)" /></mask>
            <filter id="earth-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#234B37" floodOpacity=".14" /></filter>
          </defs>
          <g className="globe-map" data-testid="globe-planet" data-globe-angle={rotation} transform={`rotate(${rotation} 180 180)`}>
            <circle data-testid="earth-sphere" cx="180" cy="180" r="132" fill="url(#ocean)" filter="url(#earth-shadow)" />
            <g clipPath="url(#earth-clip)" fill="url(#land)">
              <path d="M-17 91 0 77l16-4 12-13 20 2 8-8 17 4 12 12 17 5 9 15-7 12-15 5-4 13-13 6-7 17-17 7-6 17-12 2-9-14-15-5-10-14-18-4-7-15-13-5-5-12z" />
              <path d="m82 157 12 1 7 10 8 3 7 12 9 4-3 12-9-3-8-11-12-4-9-9z" />
              <path d="m111 183 18-8 14 5 9 15-4 17-8 19-4 22-9 23-9 15-8-9-2-19-9-19 3-16-7-15 6-14-7-9z" />
              <path d="m158 88 10-9 12 4 8-5 13 7 13-3 9 9 14 1 8 10 14-1 8 9 17-1 10 8 18 1 13 12-4 10-14 2-8 9-17-3-7 9-16-2-9 8-13-3-8 11-12-6-8 8-9-4-3-13-11-5-3-10-12-2-5-10-12-1-7-10-11-1-4-10z" />
              <path d="m187 145 14-8 14 3 12 12 5 17-5 18-10 15-8 22-10 20-10 18-9-6-4-18-10-17-2-18-7-14 5-14-4-12 9-8z" />
              <path d="m233 166 13-3 11 8 7 14-8 12-5 18-7-9-3-16-10-11z" />
              <path d="m264 195 10 4 8 13-3 17-8-7-5-13z" />
              <path d="m306 153 5 4-2 11-5 5-3-7z m-30 75 10 3 7 6 12 3 5 7-12 2-11-5-12-2z" />
              <path d="m292 241 17-7 19 5 13 12-2 13-12 9-17-2-15-9-8-11z" />
            </g>
            {cityNames.map((name, index) => <CitySkyline key={name} name={name} index={index} count={cityNames.length} />)}
            <circle cx="180" cy="180" r="132" fill="url(#earth-glow)" pointerEvents="none" />
          </g>
        </svg>
      </button>
    </div>
  )
}
