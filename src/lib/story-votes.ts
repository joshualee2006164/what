export type StoryVote = { storyId: string; userId: string; opinionId: 'a' | 'b' | 'undecided' }

/** Only a record belonging to both the current story and current reader is a selected answer. */
export function findStoryVote(votes: StoryVote[], storyId: string | null, userId: string | null | undefined) {
  if (!storyId || !userId) return undefined
  return votes.find((vote) => vote.storyId === storyId && vote.userId === userId)?.opinionId
}
