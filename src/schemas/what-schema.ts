import type { CollectionSchema } from 'deepspace/schema'

const readOnly = { create: false, update: false, delete: false } as const
const privateCollection = { '*': { read: false, ...readOnly }, viewer: { read: false, ...readOnly } }

export const storiesSchema: CollectionSchema = {
  name: 'stories',
  columns: [
    { name: 'headline', storage: 'text', interpretation: 'plain', required: true, maxLength: 220 },
    { name: 'summary', storage: 'text', interpretation: 'plain', required: true, maxLength: 900 },
    { name: 'bubbleSummary', storage: 'text', interpretation: 'plain', required: true, maxLength: 180 },
    { name: 'category', storage: 'text', interpretation: 'plain', required: true, maxLength: 40 },
    { name: 'sourceUrls', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'sourceNames', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'sourceTitles', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'sourcePublishedAt', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'presentationVersion', storage: 'text', interpretation: 'plain', maxLength: 12 },
    { name: 'opinionVersion', storage: 'text', interpretation: 'plain', maxLength: 80 },
    { name: 'opinionHistory', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'publishedAt', storage: 'text', interpretation: 'plain', required: true },
    { name: 'generatedAt', storage: 'text', interpretation: 'plain', required: true },
    { name: 'discussionQuestion', storage: 'text', interpretation: 'plain', required: true, maxLength: 220 },
    { name: 'opinionA', storage: 'text', interpretation: 'plain', required: true, maxLength: 180 },
    { name: 'opinionB', storage: 'text', interpretation: 'plain', required: true, maxLength: 180 },
    { name: 'perspectivesA', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'perspectivesB', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'perspectivesVersion', storage: 'text', interpretation: 'plain', maxLength: 12 },
    { name: 'sourceHash', storage: 'text', interpretation: 'plain', required: true },
    { name: 'disclosure', storage: 'text', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['sourceHash'],
  permissions: {
    '*': { read: true, ...readOnly },
    viewer: { read: true, ...readOnly },
    member: { read: true, ...readOnly },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'storyId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'opinionId', storage: 'text', interpretation: 'plain', required: true, maxLength: 20 },
    { name: 'opinionVersion', storage: 'text', interpretation: 'plain', required: true },
    { name: 'votedAt', storage: 'text', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['storyId', 'userId'],
  ownerField: 'userId',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'own', create: false, update: 'own', delete: false },
    member: { read: 'own', create: false, update: 'own', delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const commentsSchema: CollectionSchema = {
  name: 'comments',
  columns: [
    { name: 'storyId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'authorId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'authorName', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 60 },
    { name: 'opinionId', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 20 },
    { name: 'opinionVersion', storage: 'text', interpretation: 'plain', immutable: true, maxLength: 80 },
    { name: 'text', storage: 'text', interpretation: 'plain', required: true, maxLength: 500 },
    { name: 'parentCommentId', storage: 'text', interpretation: 'plain', immutable: true, maxLength: 100 },
    { name: 'postedAt', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  ownerField: 'authorId',
  permissions: {
    '*': { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const perspectiveUpvotesSchema: CollectionSchema = {
  name: 'perspective_upvotes',
  columns: [
    { name: 'storyId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'perspectiveId', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 500 },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'createdAt', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  uniqueOn: ['perspectiveId', 'userId'],
  ownerField: 'userId',
  permissions: {
    ...privateCollection,
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: false, create: false, update: false, delete: false },
  },
}

export const proposalsSchema: CollectionSchema = {
  name: 'opinion_proposals',
  columns: [
    { name: 'storyId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'authorId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'opinionA', storage: 'text', interpretation: 'plain', required: true, maxLength: 180 },
    { name: 'opinionB', storage: 'text', interpretation: 'plain', required: true, maxLength: 180 },
    { name: 'status', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'submittedAt', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  uniqueOn: ['storyId', 'authorId'],
  ownerField: 'authorId',
  permissions: {
    ...privateCollection,
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const refreshLocksSchema: CollectionSchema = {
  name: 'news_refresh_locks',
  columns: [
    { name: 'lockKey', storage: 'text', interpretation: 'plain', required: true },
    { name: 'startedAt', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'state', storage: 'text', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['lockKey'],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const whatSchemas: CollectionSchema[] = [
  storiesSchema,
  votesSchema,
  commentsSchema,
  perspectiveUpvotesSchema,
  proposalsSchema,
  refreshLocksSchema,
]
