export type ActivityComment = { storyId: string; authorId: string; postedAt: string }

export const HOT_TOPIC_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
export const HOT_TOPIC_MIN_COMMENTS = 4
export const HOT_TOPIC_MIN_PARTICIPANTS = 3

const sensitiveTopic = /\b(war|attack|bomb|death|dead|killed|fatal|earthquake|flood|wildfire|shooting|disaster|genocide|tragedy|crash)\b/i

/** Mark only active, multi-person conversations; suppress tragedy and disaster framing. */
export function hasActiveDiscussion(
  comments: ActivityComment[],
  storyId: string,
  storyText: string,
  now = Date.now(),
) {
  if (sensitiveTopic.test(storyText)) return false
  const recent = comments.filter((comment) => {
    const time = Date.parse(comment.postedAt)
    return comment.storyId === storyId && Number.isFinite(time) && now - time >= 0 && now - time <= HOT_TOPIC_WINDOW_MS
  })
  return recent.length >= HOT_TOPIC_MIN_COMMENTS && new Set(recent.map((comment) => comment.authorId)).size >= HOT_TOPIC_MIN_PARTICIPANTS
}
