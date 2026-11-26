import { describe, expect, it } from 'vitest'
import { getAiDisplayName } from './ai-personas'

describe('AI perspective display names', () => {
  it('keeps a persona stable for the same cached argument', () => {
    const name = getAiDisplayName('story-1', 'a', 0)
    expect(getAiDisplayName('story-1', 'a', 0)).toBe(name)
    expect(['Jake', 'Maya', 'Alex', 'Sophie', 'Jordan', 'Sam']).toContain(name)
  })

  it('assigns different names to the six arguments in one story', () => {
    const names = new Set(Array.from({ length: 3 }, (_, index) =>
      [getAiDisplayName('story-1', 'a', index), getAiDisplayName('story-1', 'b', index)]).flat())
    expect(names.size).toBe(6)
  })
})
