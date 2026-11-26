import { describe, expect, it } from 'vitest'
import { opposingArgumentsForVote } from './discussion-perspectives'

const a = ['A perspective 1', 'A perspective 2', 'A perspective 3']
const b = ['B perspective 1', 'B perspective 2', 'B perspective 3']

describe('opposing perspective selection', () => {
  it('shows B arguments after an A vote and A arguments after a B vote', () => {
    expect(opposingArgumentsForVote('a', a, b, 0)).toEqual(b)
    expect(opposingArgumentsForVote('b', a, b, 0)).toEqual(a)
    expect(opposingArgumentsForVote('undecided', a, b, 0)).toEqual([])
  })

  it('puts real opposing comments first and uses cached AI arguments to fill a sparse discussion', () => {
    expect(opposingArgumentsForVote('a', a, b, 1)).toEqual(b.slice(0, 2))
    expect(opposingArgumentsForVote('a', a, b, 2)).toEqual(b.slice(0, 1))
    expect(opposingArgumentsForVote('a', a, b, 3)).toEqual([])
  })
})
