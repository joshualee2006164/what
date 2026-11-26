import { describe, expect, it } from 'vitest'
import { cachedOpposingArgumentsSchema, conciseOpinionSchema, conciseQuestionSchema, createFallbackPerspectives, normalizeGeneratedBubbleSummary, normalizeGeneratedQuestion, opposingArgumentsSchema, parseGeneratedStories, readChatCompletion, resolveSourceReferences } from './news-generation'

// Clearly synthetic parser fixtures: these strings are not application stories or seed data.
const validStory = {
  candidateId: 'candidate-1',
  summary: 'This clearly labeled test fixture describes a public proposal and the reported debate around its likely effects. It contains no factual claims about a live event and exists only to exercise schema checks for concise context summaries. It cannot be used to create application content.',
  bubbleSummary: 'A clearly labeled test fixture about one public proposal and the different views around its possible effects.',
  category: 'Politics',
  discussionQuestion: 'Should lawmakers adopt the public transit proposal?',
  opinionA: 'Support it with sensible safeguards',
  opinionB: 'Wait for stronger evidence first',
  perspectivesA: [
    'Supporters may value the proposal because it could make the process more accessible to people who currently face practical barriers.',
    'Some readers may see this as a fair way to share the benefits while keeping clear public safeguards in place.',
    'A measured trial could show whether the proposal works before officials expand it.',
  ],
  perspectivesB: [
    'Others may worry the proposal could create new costs that are difficult to sustain without a clear long-term funding plan.',
    'Some people may prefer waiting because the available reporting leaves important questions about oversight and outcomes unresolved.',
    'A cautious approach can leave more time to compare options and hear from groups most affected by the change.',
  ],
  sourceIds: ['candidate-1-newsapi', 'candidate-1-exa-1'],
}

describe('parseGeneratedStories', () => {
  it('creates three cached fallback perspectives for each side', () => {
    const fallback = createFallbackPerspectives('Support the proposal', 'Reject the proposal')
    expect(fallback.perspectivesA).toHaveLength(3)
    expect(fallback.perspectivesB).toHaveLength(3)
    expect(fallback.perspectivesA[0]).toContain('Support the proposal')
    expect(fallback.perspectivesB[0]).toContain('Reject the proposal')
    expect(opposingArgumentsSchema.safeParse(fallback.perspectivesA).success).toBe(true)
    expect(opposingArgumentsSchema.safeParse(fallback.perspectivesB).success).toBe(true)
    expect(opposingArgumentsSchema.safeParse([
      'Costs may rise if plans change after review.',
      'Residents may prefer clearer funding before local services are changed.',
      'A smaller trial could help officials compare the expected results first.',
    ]).success).toBe(true)
    const olderCachedArgument = 'Some readers may wait for stronger reporting before deciding whether the wider policy can work safely in their communities, especially when local costs and oversight remain uncertain.'
    expect(olderCachedArgument.trim().split(/\s+/)).toHaveLength(27)
    expect(cachedOpposingArgumentsSchema.safeParse([olderCachedArgument, ...fallback.perspectivesA.slice(1)]).success).toBe(true)
    expect(opposingArgumentsSchema.safeParse([olderCachedArgument, ...fallback.perspectivesA.slice(1)]).success).toBe(true)
  })

  it('accepts a self-contained plain-language binary disagreement without semantic style rules', () => {
    const result = parseGeneratedStories(JSON.stringify({
      stories: [{
        ...validStory,
        discussionQuestion: 'Should companies put profits before ethical leadership?',
        opinionA: 'Yes, making money is their job.',
        opinionB: 'No, ethics should come first.',
      }],
    }))
    expect(result).toMatchObject({ ok: true, stories: [{ discussionQuestion: 'Should companies put profits before ethical leadership?' }] })
  })
  it('accepts structurally valid questions and choices without rejecting stylistic differences', () => {
    expect(conciseQuestionSchema.safeParse('Should Congress make the public transit proposal law?').success).toBe(true)
    expect(conciseQuestionSchema.safeParse('Should lawmakers adopt this public proposal?').success).toBe(true)
    expect(conciseQuestionSchema.safeParse('What are the implications of this incident for congressional oversight and executive power?').success).toBe(true)
    expect(conciseQuestionSchema.safeParse('   ').success).toBe(false)
    expect(conciseOpinionSchema.safeParse('Yes, students need fewer distractions.').success).toBe(true)
    expect(conciseOpinionSchema.safeParse('Advocates may argue students need fewer distractions.').success).toBe(true)
    expect(conciseOpinionSchema.safeParse('Yes, companies should prioritize long-term ethical leadership over short-term gains.').success).toBe(true)
    expect(conciseQuestionSchema.safeParse('Should lawmakers adopt this proposal after weighing its cost, community impact, timing, oversight, and possible long-term consequences for residents?').success).toBe(true)
    expect(parseGeneratedStories(JSON.stringify({ stories: [validStory] }))).toMatchObject({ ok: true, stories: [validStory] })
  })

  it('does not reject a valid story when an optional perspective array has the wrong structure', () => {
    const result = parseGeneratedStories(JSON.stringify({ stories: [{ ...validStory, perspectivesB: validStory.perspectivesB.slice(0, 2) }] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stories).toHaveLength(1)
    expect(result.stories[0].perspectivesA).toBeUndefined()
    expect(result.stories[0].perspectivesB).toBeUndefined()
    expect(result.optionalIssues).toEqual([{ index: 0, field: 'perspectivesB', reason: 'invalid_structure' }])
  })

  it('does not reject otherwise valid stories for stylistic question, summary, bubble, or perspective lengths', () => {
    const longArgument = 'Some readers may wait for stronger reporting before deciding whether the wider policy can work safely in their communities, especially when local costs and oversight remain uncertain.'
    const result = parseGeneratedStories(JSON.stringify({ stories: [{
      ...validStory,
      summary: Array.from({ length: 85 }, (_, index) => `context${index}`).join(' '),
      bubbleSummary: Array.from({ length: 22 }, (_, index) => `note${index}`).join(' '),
      discussionQuestion: 'Should city officials adopt the proposal after reviewing community feedback, service reliability, construction costs, and long-term funding plans?',
      perspectivesA: [longArgument, longArgument, longArgument],
      perspectivesB: [longArgument, longArgument, longArgument],
    }] }))

    expect(result).toMatchObject({ ok: true, rejected: [] })
    if (!result.ok) return
    expect(result.stories).toHaveLength(1)
    expect(result.stories[0].perspectivesA).toHaveLength(3)
    expect(result.stories[0].discussionQuestion).toContain('long-term funding plans?')
  })

  it('normalizes punctuation and spacing without replacing the question with a generic headline prompt', () => {
    expect(normalizeGeneratedQuestion('  Should the city keep families together during immigration enforcement.  '))
      .toBe('Should the city keep families together during immigration enforcement?')
    expect(normalizeGeneratedQuestion('Is it fair to give politicians special protections?'))
      .toBe('Is it fair to give politicians special protections?')
  })

  it('normalizes overlong optional bubble summaries without losing a valid story', () => {
    const longSummary = `${'A carefully reported public proposal includes distinct community and budget impacts. '.repeat(5)}`
    const result = parseGeneratedStories(JSON.stringify({ stories: [{ ...validStory, bubbleSummary: longSummary }] }))
    expect(result).toMatchObject({ ok: true, rejected: [] })
    const normalized = normalizeGeneratedBubbleSummary(longSummary, 'A verified source headline')
    expect(normalized.length).toBeLessThanOrEqual(180)
    expect(longSummary).toContain(normalized)
    expect(normalizeGeneratedBubbleSummary(undefined, 'A verified source headline'))
      .toBe('A verified source headline')
  })

  it('normalizes known category variations and isolates unsupported categories', () => {
    const response = JSON.stringify({
      stories: [
        validStory,
        { ...validStory, candidateId: 'candidate-2', category: 'Politics & Government' },
        { ...validStory, candidateId: 'candidate-3', category: 'Sports' },
      ],
    })

    const result = parseGeneratedStories(response)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stories).toHaveLength(2)
    expect(result.stories[0].candidateId).toBe('candidate-1')
    expect(result.stories[1].category).toBe('Politics')
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'stories.2.category', code: 'invalid_value' }),
    ]))
  })

  it('reports required-field and length violations without returning raw generated text in diagnostics', () => {
    const bad = { ...validStory, summary: 'too short', opinionA: undefined }
    const result = parseGeneratedStories(JSON.stringify({ stories: [bad] }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stories).toHaveLength(0)
    expect(result.rejected[0].issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'stories.0.summary', 'stories.0.opinionA',
    ]))
    expect(JSON.stringify(result.rejected)).not.toContain('too short')
  })

  it('rejects missing essential questions but does not reject answers for word count', () => {
    const result = parseGeneratedStories(JSON.stringify({ stories: [{
      ...validStory,
      discussionQuestion: undefined,
      opinionA: 'Yes, this position has more words than the old style target but is still valid as text.',
    }] }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stories).toHaveLength(0)
    expect(result.rejected[0].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'stories.0.discussionQuestion' }),
    ]))
  })

  it('distinguishes malformed JSON and a wrongly nested response envelope', () => {
    expect(parseGeneratedStories('{"stories":[{')).toMatchObject({ ok: false, reason: 'malformed_json' })
    expect(parseGeneratedStories(JSON.stringify({ data: { stories: [validStory] } })))
      .toMatchObject({ ok: false, reason: 'invalid_envelope' })
  })

  it('accepts a fenced JSON object while preserving schema validation', () => {
    const result = parseGeneratedStories(`\`\`\`json\n${JSON.stringify({ stories: [validStory] })}\n\`\`\``)
    expect(result).toMatchObject({ ok: true, stories: [validStory], rejected: [] })
  })
})

describe('resolveSourceReferences', () => {
  const retrieved = [
    { id: 'candidate-1-newsapi', text: 'A'.repeat(140), url: 'https://news.example/item' },
    { id: 'candidate-1-exa-1', text: 'B'.repeat(120), url: 'https://report.example/item' },
  ]

  it('returns only source records whose IDs were actually retrieved for that candidate', () => {
    expect(resolveSourceReferences(['candidate-1-newsapi', 'candidate-1-exa-1'], retrieved))
      .toMatchObject({ ok: true, sources: retrieved })
    expect(resolveSourceReferences(['made-up-source'], retrieved))
      .toMatchObject({ ok: false, reason: 'unknown_reference' })
  })

  it('rejects matched sources that do not contain enough reporting text', () => {
    expect(resolveSourceReferences(['candidate-1-newsapi'], [retrieved[0]], 220))
      .toMatchObject({ ok: false, reason: 'insufficient_source_text' })
  })
})

describe('readChatCompletion', () => {
  it('reads text from the documented integration data.choices[0].message.content shape', () => {
    expect(readChatCompletion({
      choices: [{ message: { role: 'assistant', content: '{"stories":[]}' }, finish_reason: 'stop' }],
    })).toEqual({ content: '{"stories":[]}', finishReason: 'stop', choicesCount: 1 })
  })

  it('reports truncation and missing content without serializing the response', () => {
    expect(readChatCompletion({ choices: [{ message: { content: null }, finish_reason: 'length' }] }))
      .toEqual({ content: null, finishReason: 'length', choicesCount: 1 })
    expect(readChatCompletion({ unexpected: { secret: 'never logged' } }))
      .toEqual({ content: null, finishReason: null, choicesCount: 0 })
  })
})
