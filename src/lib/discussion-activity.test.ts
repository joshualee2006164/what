import { describe, expect, it } from 'vitest'
import { hasActiveDiscussion } from './discussion-activity'

describe('hot discussion indicator', () => {
  const now = Date.parse('2026-11-25T12:00:00Z')
  const comments = [
    { storyId: 'story-a', authorId: 'reader-a', postedAt: '2026-11-25T11:00:00Z' },
    { storyId: 'story-a', authorId: 'reader-b', postedAt: '2026-11-25T10:00:00Z' },
    { storyId: 'story-a', authorId: 'reader-c', postedAt: '2026-11-24T10:00:00Z' },
    { storyId: 'story-a', authorId: 'reader-a', postedAt: '2026-11-23T10:00:00Z' },
    { storyId: 'story-a', authorId: 'reader-d', postedAt: '2026-10-01T10:00:00Z' },
  ]

  it('requires recent comments from several actual participants on this story', () => {
    expect(hasActiveDiscussion(comments, 'story-a', 'Policy proposal', now)).toBe(true)
    expect(hasActiveDiscussion(comments, 'story-b', 'Policy proposal', now)).toBe(false)
    expect(hasActiveDiscussion(comments.slice(0, 3), 'story-a', 'Policy proposal', now)).toBe(false)
  })

  it('does not add flames to tragedy or disaster reporting', () => {
    expect(hasActiveDiscussion(comments, 'story-a', 'A deadly earthquake response', now)).toBe(false)
  })
})
