import { describe, expect, it } from 'vitest'
import { aiPerspectiveUpvoteId, humanPerspectiveUpvoteId } from './discussion-upvotes'

describe('perspective upvote identifiers', () => {
  it('keeps human comment identities tied to stable record IDs', () => {
    expect(humanPerspectiveUpvoteId('comment-record-1')).toBe('comment:comment-record-1')
    expect(humanPerspectiveUpvoteId('comment-record-1')).not.toBe(humanPerspectiveUpvoteId('comment-record-2'))
  })

  it('keeps cached AI argument identities stable but distinct across text changes', () => {
    const first = aiPerspectiveUpvoteId('story-1', 'a', 0, 'A saved argument')
    expect(aiPerspectiveUpvoteId('story-1', 'a', 0, ' A saved argument ')).toBe(first)
    expect(aiPerspectiveUpvoteId('story-1', 'a', 0, 'A different argument')).not.toBe(first)
    expect(aiPerspectiveUpvoteId('story-1', 'b', 0, 'A saved argument')).not.toBe(first)
  })
})
