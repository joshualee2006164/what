export type PerspectiveChoice = 'a' | 'b' | 'undecided' | undefined

/** Keep the authored position and displayed counter-position distinct; human comments reserve the first slots. */
export function opposingArgumentsForVote(choice: PerspectiveChoice, argumentsA: string[] | undefined, argumentsB: string[] | undefined, humanCommentCount: number) {
  if (choice !== 'a' && choice !== 'b') return []
  const opposing = choice === 'a' ? argumentsB : argumentsA
  return opposing?.slice(0, Math.max(0, 3 - Math.min(3, humanCommentCount))) ?? []
}
