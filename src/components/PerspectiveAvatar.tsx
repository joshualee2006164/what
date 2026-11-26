const portraits = [
  { background: '#E8DDF4', skin: '#D99A70', hair: '#384255', shirt: '#7892A2', hairBack: <path d="M7 17a11 11 0 0 1 22 0v7H7z" />, hairFront: <path d="M8 15c1-8 5-11 11-10 4 1 7 4 8 9-4-1-7-4-9-6-2 4-6 6-10 7z" /> },
  { background: '#F8E3D7', skin: '#F0C6A0', hair: '#704B42', shirt: '#6E9A80', hairBack: <path d="M7 16a11 11 0 0 1 22 0v10H7z" />, hairFront: <path d="M8 14c0-7 4-11 10-11s10 4 10 11c-4-2-7-5-9-8-2 4-6 6-11 8z" /> },
  { background: '#DCEBF0', skin: '#9B6049', hair: '#202936', shirt: '#D58C75', hairBack: <><circle cx="7" cy="12" r="4" /><circle cx="28" cy="12" r="4" /><path d="M7 16a11 11 0 0 1 22 0v8H7z" /></>, hairFront: <path d="M7 14a11 11 0 0 1 22 0c-4 0-7-2-9-5-3 3-7 5-13 5z" /> },
  { background: '#F1E9CC', skin: '#E5B68F', hair: '#9B6548', shirt: '#8E83AE', hairBack: <path d="M7 15a11 11 0 0 1 22 0v14H7z" />, hairFront: <path d="M7 14c0-8 4-12 11-12s11 4 11 12c-3-1-5-3-7-6-3 4-8 6-15 6z" /> },
  { background: '#E5E8D3', skin: '#C37E5B', hair: '#3A332E', shirt: '#D4A64D', hairBack: <><path d="M26 8c8-1 8 7 4 10l-4-1z" /><path d="M7 16a11 11 0 0 1 22 0v9H7z" /></>, hairFront: <path d="M7 14c0-8 4-12 11-12 6 0 11 5 11 13-4-1-7-4-9-8-3 4-7 6-13 7z" /> },
  { background: '#F0DCE5', skin: '#8A5947', hair: '#5D3C62', shirt: '#6D91A5', hairBack: <><circle cx="8" cy="10" r="5" /><circle cx="15" cy="6" r="5" /><circle cx="23" cy="7" r="5" /><circle cx="29" cy="12" r="5" /><path d="M7 15a11 11 0 0 1 22 0v10H7z" /></>, hairFront: <path d="M7 14c0-8 4-12 11-12 6 0 11 5 11 12-4-1-7-4-9-7-3 4-7 6-13 7z" /> },
] as const
const aiPersonaVariants = new Map([
  ['Jake', 0], ['Maya', 1], ['Alex', 2], ['Sophie', 3], ['Jordan', 4], ['Sam', 5],
])

function stableIndex(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % portraits.length
}

export default function PerspectiveAvatar({ seed, imageUrl }: { seed: string; imageUrl?: string }) {
  const personaName = seed.startsWith('ai:') ? seed.slice(3) : ''
  const index = aiPersonaVariants.get(personaName) ?? stableIndex(seed)
  const portrait = portraits[index]
  if (imageUrl && /^https:\/\//i.test(imageUrl)) {
    return <img className="perspective-avatar" src={imageUrl} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
  }
  return <svg className="perspective-avatar" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
    <circle cx="18" cy="18" r="18" fill={portrait.background} />
    <g stroke="none" fill={portrait.hair}>{portrait.hairBack}</g>
    <path d="M4 37c1-8 6-11 14-11s13 3 14 11z" fill={portrait.shirt} />
    <path d="M15 23h6v6h-6z" fill={portrait.skin} />
    <ellipse cx="18" cy="16" rx="8.2" ry="9.5" fill={portrait.skin} />
    <g fill={portrait.hair}>{portrait.hairFront}</g>
    <g fill="#382F2C"><circle cx="15" cy="16" r=".75" /><circle cx="21" cy="16" r=".75" /></g>
    <path d="M16 20q2 1.5 4 0" fill="none" stroke="#8D5148" strokeWidth=".8" strokeLinecap="round" />
  </svg>
}
