import { describe, expect, it } from 'vitest'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import { actions } from './index'
import { aiPerspectiveUpvoteId, humanPerspectiveUpvoteId, publicUpvoteReaderId } from '../lib/discussion-upvotes'
import { perspectiveUpvotesSchema } from '../schemas/what-schema'

type TestRecord = {
  recordId: string
  data: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

type TypedTestRecord<T> = Omit<TestRecord, 'data'> & { data: T }
type UpvoteContext = Parameters<typeof actions['set-perspective-upvote']>[0]

function createHarness() {
  const rows = new Map<string, TestRecord>()
  let nextRecord = 0
  const story = {
    headline: 'A reported policy',
    summary: 'A verified story summary with enough supporting details.',
    bubbleSummary: 'A verified story',
    category: 'policy',
    sourceUrls: ['https://example.com/a', 'https://example.org/a'],
    sourceNames: ['Example A', 'Example B'],
    sourceTitles: [],
    sourcePublishedAt: [],
    publishedAt: '2026-01-01T00:00:00.000Z',
    generatedAt: '2026-01-01T00:00:00.000Z',
    discussionQuestion: 'Should the policy move ahead?',
    opinionA: 'Support it',
    opinionB: 'Reject it',
    perspectivesA: ['A saved supporting argument'],
    perspectivesB: ['A saved opposing argument'],
    sourceHash: 'verified-hash',
    disclosure: 'AI-generated from sources.',
  }
  rows.set('stories:story-1', {
    recordId: 'story-1',
    data: story,
    createdBy: 'admin',
    createdAt: story.generatedAt,
    updatedAt: story.generatedAt,
  })
  rows.set('comments:comment-1', {
    recordId: 'comment-1',
    data: { storyId: 'story-1', opinionId: 'a', text: 'A reader argument' },
    createdBy: 'reader-1',
    createdAt: story.generatedAt,
    updatedAt: story.generatedAt,
  })

  const tools: ActionTools = {
    create: async (collection, data) => {
      if (collection === 'perspective_upvotes' && [...rows.values()].some((row) =>
        row.recordId.startsWith('perspective_upvotes:') &&
        row.data.perspectiveId === data.perspectiveId &&
        row.data.userId === data.userId)) {
        return { success: false, error: 'Duplicate record', code: 'duplicate_record' }
      }
      const recordId = `${collection}:${++nextRecord}`
      const now = new Date().toISOString()
      rows.set(recordId, { recordId, data, createdBy: String(data.userId ?? ''), createdAt: now, updatedAt: now })
      return { success: true, data: { recordId } }
    },
    update: async (_collection, recordId) => ({ success: true, data: { recordId } }),
    remove: async (_collection, recordId) => {
      rows.delete(recordId)
      return { success: true, data: { recordId } }
    },
    deleteWhere: async () => ({ success: true, data: { deleted: 0 } }),
    get: async <T extends Record<string, unknown>>(collection: string, recordId: string): Promise<ActionResult<{ record: TypedTestRecord<T> }>> => {
      const row = rows.get(`${collection}:${recordId}`)
      return row
        ? { success: true, data: { record: row as TypedTestRecord<T> } }
        : { success: false, error: 'Record not found', code: 'not_found' }
    },
    query: async <T extends Record<string, unknown>>(
      collection: string,
      options?: { where?: Record<string, unknown>; orderBy?: string; orderDir?: 'asc' | 'desc'; limit?: number },
    ): Promise<ActionResult<{ records: TypedTestRecord<T>[]; count: number }>> => {
      const matches = [...rows.values()].filter((row) =>
        row.recordId.startsWith(`${collection}:`) &&
        Object.entries(options?.where ?? {}).every(([key, value]) => row.data[key] === value))
      const records = (options?.limit ? matches.slice(0, options.limit) : matches) as TypedTestRecord<T>[]
      return { success: true, data: { records, count: matches.length } }
    },
    integration: async () => ({ success: false, error: 'Not used by this test.' }),
    registerUser: async () => ({ success: false, error: 'Not used by this test.' }),
  }

  function context(userId: string, params: Record<string, unknown>): UpvoteContext {
    return {
      userId,
      params,
      tools,
      env: {} as UpvoteContext['env'],
      callerJwt: '',
    }
  }

  function upvoteCount(perspectiveId: string) {
    return [...rows.values()].filter((row) =>
      row.recordId.startsWith('perspective_upvotes:') && row.data.perspectiveId === perspectiveId).length
  }

  return { context, upvoteCount }
}

describe('perspective upvotes', () => {
  it('creates, restores, and removes one persistent upvote per user and perspective', async () => {
    const harness = createHarness()
    const perspectiveId = aiPerspectiveUpvoteId('story-1', 'a', 0, 'A saved supporting argument')
    const setUpvote = actions['set-perspective-upvote']

    const first = await setUpvote(harness.context('reader-1', { storyId: 'story-1', perspectiveId, upvoted: true }))
    const repeated = await setUpvote(harness.context('reader-1', { storyId: 'story-1', perspectiveId, upvoted: true }))
    expect(first).toMatchObject({ success: true, data: { count: 1, upvoted: true } })
    expect(repeated).toMatchObject({ success: true, data: { count: 1, upvoted: true } })
    expect(harness.upvoteCount(perspectiveId)).toBe(1)

    const restored = await actions['perspective-upvote-stats'](harness.context('reader-1', {
      storyId: 'story-1',
      perspectiveIds: [perspectiveId],
    }))
    expect(restored).toMatchObject({ success: true, data: { counts: { [perspectiveId]: 1 }, upvotedIds: [perspectiveId] } })

    const removed = await setUpvote(harness.context('reader-1', { storyId: 'story-1', perspectiveId, upvoted: false }))
    const repeatedRemoval = await setUpvote(harness.context('reader-1', { storyId: 'story-1', perspectiveId, upvoted: false }))
    expect(removed).toMatchObject({ success: true, data: { count: 0, upvoted: false } })
    expect(repeatedRemoval).toMatchObject({ success: true, data: { count: 0, upvoted: false } })
    expect(harness.upvoteCount(perspectiveId)).toBe(0)
  })

  it('resolves concurrent duplicate creates to one stored upvote', async () => {
    const harness = createHarness()
    const perspectiveId = humanPerspectiveUpvoteId('comment-1')
    const setUpvote = actions['set-perspective-upvote']
    const params = { storyId: 'story-1', perspectiveId, upvoted: true }

    const results = await Promise.all([
      setUpvote(harness.context('reader-1', params)),
      setUpvote(harness.context('reader-1', params)),
    ])

    expect(results).toHaveLength(2)
    expect(results.every((result) => result.success)).toBe(true)
    expect(harness.upvoteCount(perspectiveId)).toBe(1)
  })

  it('returns aggregate counts without voter identities and rejects unknown perspectives', async () => {
    const harness = createHarness()
    const perspectiveId = aiPerspectiveUpvoteId('story-1', 'b', 0, 'A saved opposing argument')
    const setUpvote = actions['set-perspective-upvote']
    await setUpvote(harness.context('reader-1', { storyId: 'story-1', perspectiveId, upvoted: true }))

    const counts = await actions['perspective-upvote-stats'](harness.context(publicUpvoteReaderId, {
      storyId: 'story-1',
    }))
    expect(counts).toMatchObject({ success: true, data: { counts: { [perspectiveId]: 1 }, upvotedIds: [] } })
    expect(JSON.stringify(counts)).not.toContain('reader-1')

    const invalid = await setUpvote(harness.context('reader-1', {
      storyId: 'story-1',
      perspectiveId: 'ai:story-1:b:0:invented argument',
      upvoted: true,
    }))
    expect(invalid).toMatchObject({ success: false, code: 'not_found' })
  })

  it('enforces a native per-user uniqueness constraint', () => {
    expect(perspectiveUpvotesSchema.uniqueOn).toEqual(['perspectiveId', 'userId'])
    expect(perspectiveUpvotesSchema.permissions.member).toEqual({ read: false, create: false, update: false, delete: false })
  })
})
