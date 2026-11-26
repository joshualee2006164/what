import { describe, expect, it } from 'vitest'
import { isDiscoveryStory, pickUnseenStory } from './story-selection'

const stories = [{ recordId: 'one' }, { recordId: 'two' }, { recordId: 'three' }]

describe('unseen story selection', () => {
  it('selects only an unseen story when one remains', () => {
    const result = pickUnseenStory(stories, new Set(['one', 'two']), undefined, () => 0)
    expect(result.story?.recordId).toBe('three')
    expect(result.resetSeen).toBe(false)
  })

  it('starts a new round after all alternatives have been seen and skips the current story', () => {
    const result = pickUnseenStory(stories, new Set(stories.map((story) => story.recordId)), 'one', () => 0)
    expect(result.story?.recordId).toBe('two')
    expect(result.resetSeen).toBe(true)
  })

  it('returns the only story when no alternative exists', () => {
    const result = pickUnseenStory([stories[0]], new Set(['one']), 'one', () => 0)
    expect(result.story?.recordId).toBe('one')
    expect(result.resetSeen).toBe(false)
  })

  it('can select stories beyond the first five records', () => {
    const largerPool = Array.from({ length: 30 }, (_, index) => ({ recordId: `story-${index + 1}` }))
    const result = pickUnseenStory(largerPool, new Set(largerPool.slice(0, 29).map((story) => story.recordId)), undefined, () => 0)
    expect(result.story?.recordId).toBe('story-30')
  })
})

describe('discovery story quality hints', () => {
  it('filters routine sports scores and generic appointments from saved legacy stories', () => {
    expect(isDiscoveryStory({ headline: 'Jayden Daniels leads the Commanders to a comeback victory', summary: 'A recap of Sunday’s game.' })).toBe(false)
    expect(isDiscoveryStory({ headline: 'Club names new head coach', category: 'Sports' })).toBe(false)
  })

  it('keeps sports coverage when reporting describes a real public controversy', () => {
    expect(isDiscoveryStory({ headline: 'League faces labor dispute over player safety rules', summary: 'Players and officials disagree about enforcement.' })).toBe(true)
  })
})
