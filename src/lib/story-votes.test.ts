import { describe, expect, it } from 'vitest'
import { findStoryVote, type StoryVote } from './story-votes'

describe('story-scoped vote restoration', () => {
  it('keeps the answer cards available through five consecutive story transitions', () => {
    const reader = 'reader-1'
    const votes: StoryVote[] = []
    const answers = ['a', 'b', 'a', 'b', 'a'] as const

    for (let index = 0; index < 5; index += 1) {
      const storyId = `story-${index + 1}`
      expect(findStoryVote(votes, storyId, reader), `unvoted ${storyId} should show both cards`).toBeUndefined()
      votes.push({ storyId, userId: reader, opinionId: answers[index] })
      expect(findStoryVote(votes, storyId, reader)).toBe(answers[index])
      expect(findStoryVote(votes, `story-${index + 2}`, reader), 'the next story must not inherit this choice').toBeUndefined()
    }

    expect(findStoryVote(votes, 'story-1', reader)).toBe('a')
    expect(findStoryVote(votes, 'story-2', reader)).toBe('b')
    expect(findStoryVote(votes, 'story-3', reader)).toBe('a')
    expect(findStoryVote(votes, 'story-4', reader)).toBe('b')
    expect(findStoryVote(votes, 'story-5', reader)).toBe('a')
  })

  it('does not restore another reader’s vote or a vote while identity is unresolved', () => {
    const votes: StoryVote[] = [{ storyId: 'story-1', userId: 'someone-else', opinionId: 'b' }]
    expect(findStoryVote(votes, 'story-1', 'reader-1')).toBeUndefined()
    expect(findStoryVote(votes, 'story-1', undefined)).toBeUndefined()
    expect(findStoryVote(votes, null, 'reader-1')).toBeUndefined()
  })
})
