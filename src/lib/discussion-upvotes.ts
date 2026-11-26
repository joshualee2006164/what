export type PerspectiveSide = 'a' | 'b'
export const publicUpvoteReaderId = '__public_read_only__'

export function humanPerspectiveUpvoteId(commentId: string) {
  return `comment:${commentId}`
}

export function aiPerspectiveUpvoteId(storyId: string, side: PerspectiveSide, index: number, text: string) {
  return `ai:${storyId}:${side}:${index}:${text.trim()}`
}
