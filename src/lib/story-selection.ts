export type StoryChoice = { recordId: string }

type StoryQualityHint = { headline?: string; summary?: string; category?: string }

/** Hide obvious routine score/appointment items already saved by an older refresh. */
export function isDiscoveryStory(story: StoryQualityHint) {
  const text = `${story.headline ?? ''} ${story.summary ?? ''}`
  const publicDebate = /\b(controvers|debate|dispute|investigat|lawsuit|policy|protest|scandal|alleg|rule|ban|labor|union|rights|funding|regulat|strike|boycott|corruption)\w*\b/i.test(text)
  const sportsTopic = /\b(NFL|NBA|MLB|NHL|WNBA|quarterback|touchdown|playoffs?|coach|team|league|baseball|basketball|football|soccer|hockey|tennis|golf|Commanders|Lakers|Yankees|Warriors)\b/i.test(text)
  const routineSports = sportsTopic && /\b(wins?|won|beat|beats|defeat\w*|victory|comeback|game results?|scores?|season opener|names?|named|appointed|hired)\b/i.test(text) && !publicDebate
  const routineAnnouncement = /\b(appointed|names?|named|hired|announces? new|unveils?)\b/i.test(story.headline ?? '') && !publicDebate
  return !routineSports && !routineAnnouncement
}

export type StorySelection<T> = {
  story: T | undefined
  resetSeen: boolean
}

/** Pick an unseen story at random, excluding the current one when possible. */
export function pickUnseenStory<T extends StoryChoice>(
  stories: T[],
  seenIds: Set<string>,
  currentId?: string,
  random: () => number = Math.random,
): StorySelection<T> {
  const alternatives = stories.filter((story) => story.recordId !== currentId)
  const unseen = alternatives.filter((story) => !seenIds.has(story.recordId))
  const resetSeen = unseen.length === 0 && alternatives.length > 0
  const pool = unseen.length > 0 ? unseen : alternatives
  if (!pool.length && stories.length) return { story: stories[0], resetSeen: false }
  if (!pool.length) return { story: undefined, resetSeen: false }
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  return { story: pool[index], resetSeen }
}
