import { describe, expect, it } from 'vitest'
import { buildExaSearchQuery, hasIndependentPublisherCount, independentSources, isTrustedNewsPublisher, likelySameEventArticle, normalizeArticleUrl, publisherKey } from './news-sources'

const textA = 'The national government announced a new policy after weeks of debate. Officials said the change begins next month. Local groups say they were not consulted, while researchers point to mixed evidence about the likely costs and benefits.'
const textB = 'The government has announced the policy following weeks of discussion. The change starts next month, officials said. Community organizations criticized the process, while researchers say evidence on likely costs and benefits remains mixed.'

describe('news source quality helpers', () => {
  it('canonicalizes tracking URLs and identifies publisher domains', () => {
    expect(normalizeArticleUrl('https://www.apnews.com/article/story?utm_source=feed&id=4#top'))
      .toBe('https://apnews.com/article/story?id=4')
    expect(normalizeArticleUrl('https://m.bbc.co.uk/news/article/amp?utm_source=feed'))
      .toBe('https://bbc.co.uk/news/article')
    expect(normalizeArticleUrl('http://regional.npr.org/story/1')).toBe('https://regional.npr.org/story/1')
    expect(normalizeArticleUrl('http://untrusted.example/story')).toBeNull()
    expect(publisherKey('https://news.bbc.co.uk/world/story')).toBe('bbc')
    expect(publisherKey('https://m.bbc.com/news/story')).toBe('bbc')
    expect(publisherKey('https://www.bbc.co.uk/news/story')).toBe('bbc')
    expect(publisherKey('https://www.apnews.com/article/story')).toBe('ap')
    expect(publisherKey('https://www.ap.org/article/story')).toBe('ap')
    expect(publisherKey('https://www.abc.net.au/news/story')).toBe('abc-au')
    expect(publisherKey('https://www.abcnews.com.au/news/story')).toBe('abc-au')
    expect(isTrustedNewsPublisher('https://www.reuters.com/world/story')).toBe(true)
    expect(isTrustedNewsPublisher('https://regional.theglobeandmail.com/news/story')).toBe(true)
    for (const host of ['cnn.com', 'cnbc.com', 'abcnews.go.com', 'elpais.com', 'csmonitor.com']) {
      expect(isTrustedNewsPublisher(`https://www.${host}/world/article`)).toBe(true)
    }
    expect(isTrustedNewsPublisher('https://made-up-blog.example/story')).toBe(false)
    expect(isTrustedNewsPublisher('https://cnn.com.not-trusted.example/world/article')).toBe(false)
  })

  it('requires distinct reputable publishers and rejects copied reporting', () => {
    const result = independentSources([
      { id: 'a', title: 'Lawmakers debate a new transit proposal', name: 'AP', url: 'https://apnews.com/article/one', text: textA, publishedAt: '2026-11-25T10:00:00Z' },
      { id: 'b', title: 'Lawmakers debate a new transit proposal', name: 'AP syndication', url: 'https://reuters.com/article/two', text: textA, publishedAt: '2026-11-25T10:00:00Z' },
      { id: 'c', title: 'Officials release details of a city transit proposal', name: 'Reuters', url: 'https://reuters.com/article/three', text: textB, publishedAt: '2026-11-25T11:00:00Z' },
    ])
    expect(result.sources.map((source) => source.id)).toEqual(['a', 'c'])
    expect(result.duplicates).toBe(1)
    expect(hasIndependentPublisherCount(result.sources)).toBe(true)
    expect(hasIndependentPublisherCount([
      { id: 'one', title: 'One', name: 'Reuters', url: 'https://reuters.com/a', text: textA, publishedAt: '' },
      { id: 'two', title: 'Two', name: 'Reuters', url: 'https://reuters.com/b', text: textB, publishedAt: '' },
    ])).toBe(false)
    expect(hasIndependentPublisherCount([
      { id: 'one', title: 'One', name: 'Associated Press', url: 'https://apnews.com/a', text: textA, publishedAt: '' },
      { id: 'two', title: 'Two', name: 'AP', url: 'https://ap.org/b', text: textB, publishedAt: '' },
    ])).toBe(false)
  })

  it('checks that Exa article titles overlap the queried event', () => {
    expect(likelySameEventArticle('Supreme Court pauses federal tariff order', 'Court temporarily pauses federal tariff plan')).toBe(true)
    expect(likelySameEventArticle('Supreme Court pauses federal tariff order', 'New study finds ocean temperatures rising')).toBe(false)
    expect(likelySameEventArticle('Officials delay coastal approval', 'Regulators postpone coastal wind permit', 'Wind farm permit review followed community objections')).toBe(true)
  })

  it('builds Exa queries from event details and publication date, not just the headline', () => {
    const query = buildExaSearchQuery(
      'Officials delay coastal approval',
      'Wind farm permit review followed community objections near Harbor City',
      '2026-11-25T10:00:00Z',
    )
    expect(query).toContain('officials delay coastal approval')
    expect(query).toContain('wind farm permit review')
    expect(query).toContain('2026-11-25')
    expect(query).toContain('independent reporting')
  })
})
