import { z } from 'zod'

export const STORY_PRESENTATION_VERSION = '4'

export const plainLanguageDebateGuidance = 'Write for someone with zero prior knowledge and do not rely on a context panel. Ask one concrete question about a real disagreement supported by the reporting. Name the actor and specific choice, and include a short factual premise when needed; explain an unfamiliar person by role or avoid an unexplained name. Use everyday words instead of technical or abstract terms. Prefer a natural opening such as “Should…”, “Is it fair…”, or “Should people be allowed to…”. Do not ask what an event means or what its implications are. The two answers must directly answer that exact question and take genuinely opposite positions, usually one clear yes and one clear no (or unmistakable equivalents). Keep them fair, parallel, and similarly qualified, preserving relevant facts and uncertainty; do not make one side sound obviously better. Aim for 4–12 everyday words per answer, but prioritize clear meaning over a word target. Never use formal framing such as “Some may argue” or “Critics suggest”. Verify every premise against the supplied reporting; do not copy illustrative examples or invent a disagreement.'

export const conciseQuestionSchema = z.string().trim().min(1).max(220)

export const conciseOpinionSchema = z.string().trim().min(1).max(180)

export const opposingArgumentsSchema = z.array(z.string().trim().min(1).max(280)).length(3)
export const cachedOpposingArgumentsSchema = opposingArgumentsSchema

const optionalGeneratedPerspectivesSchema = z.array(z.string().trim().min(1).max(280)).length(3)

const storyCategories = ['Politics', 'Society', 'Economy', 'Technology', 'Environment', 'World', 'Science', 'Education', 'Culture'] as const
const categoryAliases = new Map<string, (typeof storyCategories)[number]>([
  ['politics and government', 'Politics'], ['government and politics', 'Politics'], ['government', 'Politics'],
  ['society and social issues', 'Society'], ['social issues', 'Society'], ['business', 'Economy'],
  ['business and economy', 'Economy'], ['international affairs', 'World'], ['world news', 'World'],
  ['climate', 'Environment'], ['climate and environment', 'Environment'], ['health', 'Science'],
  ['health and science', 'Science'], ['arts and culture', 'Culture'],
])
const categorySchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const normalized = value.trim().replace(/&/g, 'and').replace(/\s+/g, ' ').toLowerCase()
  return categoryAliases.get(normalized) ?? value.trim()
}, z.enum(storyCategories))

export const generatedStorySchema = z.object({
  candidateId: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(30).max(900),
  bubbleSummary: z.unknown().optional(),
  category: categorySchema,
  discussionQuestion: conciseQuestionSchema,
  opinionA: conciseOpinionSchema,
  opinionB: conciseOpinionSchema,
  perspectivesA: z.unknown().optional(),
  perspectivesB: z.unknown().optional(),
  sourceIds: z.array(z.string().trim().min(1).max(120)).min(2).max(6)
    .refine((ids) => new Set(ids).size === ids.length, 'sourceIds must not contain duplicates'),
})

type ParsedGeneratedStory = z.infer<typeof generatedStorySchema>
export type GeneratedStory = Omit<ParsedGeneratedStory, 'perspectivesA' | 'perspectivesB'> & {
  perspectivesA?: string[]
  perspectivesB?: string[]
}
export type StoryValidationIssue = { path: string; code: string; message: string }
export type RejectedGeneratedStory = { index: number; issues: StoryValidationIssue[] }
export type OptionalGeneratedFieldIssue = {
  index: number
  field: 'perspectivesA' | 'perspectivesB'
  reason: 'invalid_structure'
}

export function normalizeGeneratedQuestion(value: string): string {
  const question = value.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  return `${question}?`
}

function truncateAtWordBoundary(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) return value
  const bounded = value.slice(0, maximumLength + 1)
  const boundary = bounded.lastIndexOf(' ')
  return (boundary > 0 ? bounded.slice(0, boundary) : bounded.slice(0, maximumLength)).trim()
}

export function normalizeGeneratedBubbleSummary(value: unknown, headline: string): string {
  const summary = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (summary) return truncateAtWordBoundary(summary, 180)
  const fallback = headline.trim().replace(/\s+/g, ' ')
  return truncateAtWordBoundary(fallback || 'A reported public-interest story', 180)
}

export function createFallbackPerspectives(opinionA: string, opinionB: string) {
  return {
    perspectivesA: [
      `A reader may choose “${opinionA}” because its trade-offs fit their priorities.`,
      'This view gives more weight to the outcome described by choice A.',
      'Someone may prefer A because it better matches what they value in this debate.',
    ],
    perspectivesB: [
      `A reader may choose “${opinionB}” because its trade-offs fit their priorities.`,
      'This view gives more weight to the outcome described by choice B.',
      'Someone may prefer B because it better matches what they value in this debate.',
    ],
  }
}

export type GeneratedStoriesResult =
  | { ok: true; stories: GeneratedStory[]; rejected: RejectedGeneratedStory[]; optionalIssues: OptionalGeneratedFieldIssue[] }
  | { ok: false; reason: 'malformed_json' | 'invalid_envelope'; issues: StoryValidationIssue[] }

const generatedStoriesEnvelope = z.object({ stories: z.array(z.unknown()).max(20) })
const chatCompletionEnvelope = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({ content: z.string().nullable().optional() }).passthrough().optional(),
  }).passthrough()).optional(),
}).passthrough()

export function readChatCompletion(response: unknown): {
  content: string | null
  finishReason: string | null
  choicesCount: number | null
} {
  const parsed = chatCompletionEnvelope.safeParse(response)
  if (!parsed.success) return { content: null, finishReason: null, choicesCount: null }
  const choices = parsed.data.choices ?? []
  const first = choices[0]
  return {
    content: typeof first?.message?.content === 'string' ? first.message.content : null,
    finishReason: first?.finish_reason ?? null,
    choicesCount: choices.length,
  }
}

export type ReferencedSource = { id: string; text: string }
export type SourceReferenceResult<T extends ReferencedSource> =
  | { ok: true; sources: T[] }
  | { ok: false; reason: 'unknown_reference' | 'insufficient_source_text'; matched: number }

/** Resolve model-provided IDs only against source records actually sent to the model. */
export function resolveSourceReferences<T extends ReferencedSource>(
  sourceIds: string[],
  availableSources: T[],
  minimumTextLength = 220,
): SourceReferenceResult<T> {
  const byId = new Map(availableSources.map((source) => [source.id, source]))
  const sources = sourceIds.map((id) => byId.get(id))
  if (sources.some((source) => !source)) return { ok: false, reason: 'unknown_reference', matched: sources.filter(Boolean).length }
  const matched = sources as T[]
  if (matched.reduce((total, source) => total + source.text.trim().length, 0) < minimumTextLength) {
    return { ok: false, reason: 'insufficient_source_text', matched: matched.length }
  }
  return { ok: true, sources: matched }
}

function summarizeIssues(issues: z.core.$ZodIssue[], prefix = ''): StoryValidationIssue[] {
  return issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join('.'),
    code: issue.code,
    message: issue.message,
  }))
}

function stripJsonFence(content: string): string {
  const match = content.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1] : content.trim()
}

/** Parse the expected OpenAI chat-completion text; reject a bad story independently. */
export function parseGeneratedStories(content: string): GeneratedStoriesResult {
  let decoded: unknown
  try {
    decoded = JSON.parse(stripJsonFence(content))
  } catch (error) {
    return {
      ok: false,
      reason: 'malformed_json',
      issues: [{
        path: '',
        code: 'json_parse_error',
        message: error instanceof SyntaxError ? error.message : 'JSON parsing failed',
      }],
    }
  }

  const envelope = generatedStoriesEnvelope.safeParse(decoded)
  if (!envelope.success) {
    return { ok: false, reason: 'invalid_envelope', issues: summarizeIssues(envelope.error.issues) }
  }

  const stories: GeneratedStory[] = []
  const rejected: RejectedGeneratedStory[] = []
  const optionalIssues: OptionalGeneratedFieldIssue[] = []
  envelope.data.stories.forEach((candidate, index) => {
    const result = generatedStorySchema.safeParse(candidate)
    if (result.success) {
      const { perspectivesA: rawPerspectivesA, perspectivesB: rawPerspectivesB, ...story } = result.data
      const perspectivesA = rawPerspectivesA === undefined ? undefined : optionalGeneratedPerspectivesSchema.safeParse(rawPerspectivesA)
      const perspectivesB = rawPerspectivesB === undefined ? undefined : optionalGeneratedPerspectivesSchema.safeParse(rawPerspectivesB)
      if (perspectivesA && !perspectivesA.success) optionalIssues.push({ index, field: 'perspectivesA', reason: 'invalid_structure' })
      if (perspectivesB && !perspectivesB.success) optionalIssues.push({ index, field: 'perspectivesB', reason: 'invalid_structure' })
      stories.push({
        ...story,
        ...(perspectivesA?.success && perspectivesB?.success
          ? { perspectivesA: perspectivesA.data, perspectivesB: perspectivesB.data }
          : {}),
      })
    } else rejected.push({ index, issues: summarizeIssues(result.error.issues, `stories.${index}`) })
  })

  return { ok: true, stories, rejected, optionalIssues }
}
