import { describe, expect, it } from 'vitest'
import { opinionForVote, preservePreviousOpinions } from './opinion-versions'

describe('versioned opinion presentation', () => {
  const original = {
    generatedAt: '2026-11-01T12:00:00.000Z',
    opinionVersion: 'v1',
    opinionA: 'Advocates favor stronger independent oversight of investigations.',
    opinionB: 'Others prefer fewer restrictions on executive authority.',
  }

  it('keeps the original position text available for voters after an admin wording update', () => {
    const history = preservePreviousOpinions(original, true)
    const updated = {
      ...original,
      opinionVersion: 'v2',
      opinionA: 'Yes, Congress should review federal investigations.',
      opinionB: 'No, the executive needs room to act.',
      opinionHistory: history,
    }

    expect(opinionForVote(updated, { opinionId: 'a', opinionVersion: 'v1' })).toBe(original.opinionA)
    expect(opinionForVote(updated, { opinionId: 'b', opinionVersion: 'v1' })).toBe(original.opinionB)
    expect(opinionForVote(updated, { opinionId: 'a', opinionVersion: 'v2' })).toBe(updated.opinionA)
  })

  it('does not add historical versions for a story with no votes', () => {
    expect(preservePreviousOpinions(original, false)).toEqual([])
  })
})
