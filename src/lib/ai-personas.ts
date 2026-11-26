const AI_DISPLAY_NAMES = ['Jake', 'Maya', 'Alex', 'Sophie', 'Jordan', 'Sam'] as const

export function getAiDisplayName(storyId: string, side: 'a' | 'b', index: number) {
  let hash = 2166136261
  for (let position = 0; position < storyId.length; position += 1) {
    hash ^= storyId.charCodeAt(position)
    hash = Math.imul(hash, 16777619)
  }
  return AI_DISPLAY_NAMES[((hash >>> 0) + index * 2 + (side === 'b' ? 3 : 0)) % AI_DISPLAY_NAMES.length]
}
