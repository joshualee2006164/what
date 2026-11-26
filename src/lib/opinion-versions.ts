export type OpinionPair = { opinionA: string; opinionB: string }
export type VersionedOpinions = OpinionPair & {
  generatedAt: string
  opinionVersion?: string
  opinionHistory?: Array<OpinionPair & { version: string }>
}
export type SavedOpinionVote = { opinionId: 'a' | 'b' | 'undecided'; opinionVersion?: string }

/** Preserve the wording a reader actually voted on when an admin refreshes the current pair. */
export function preservePreviousOpinions(story: VersionedOpinions, hasVotes: boolean) {
  if (!hasVotes) return story.opinionHistory ?? []
  const previousVersion = story.opinionVersion ?? story.generatedAt
  const history = story.opinionHistory ?? []
  return history.some((entry) => entry.version === previousVersion)
    ? history
    : [...history, { version: previousVersion, opinionA: story.opinionA, opinionB: story.opinionB }]
}

export function opinionForVote(story: VersionedOpinions, vote: SavedOpinionVote | undefined) {
  if (!vote || vote.opinionId === 'undecided') return 'Skipped — still thinking'
  const saved = story.opinionHistory?.find((entry) => entry.version === (vote.opinionVersion ?? story.generatedAt))
  return vote.opinionId === 'a' ? saved?.opinionA ?? story.opinionA : saved?.opinionB ?? story.opinionB
}
