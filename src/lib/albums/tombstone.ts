export type TombstoneReason =
  'folder_deleted' | 'flamekeeper_left' | 'flamekeeper_lost'

export function tombstoneCopy(reason: TombstoneReason): {
  title: string
  description: string
} {
  switch (reason) {
    case 'flamekeeper_left':
      return {
        title: 'This album is gone',
        description:
          'The flamekeeper who stored these photos left the initiative before they could be moved, so the photos were deleted.',
      }
    case 'flamekeeper_lost':
      return {
        title: 'This album is gone',
        description:
          'The flamekeeper who stored these photos could no longer be reached, so the photos dropped out of the app.',
      }
    case 'folder_deleted':
      return {
        title: 'This album is gone',
        description:
          'The Google Drive folder behind this album was permanently deleted, so the album was removed by an admin.',
      }
  }
}

export type FlamekeeperTombstoneReason = 'flamekeeper_lost' | 'flamekeeper_left'

export function tombstoneNoticeText(
  reason: FlamekeeperTombstoneReason,
  albumTitle: string,
  albumUrl?: string
): string {
  const why =
    reason === 'flamekeeper_lost'
      ? 'The flamekeeper who stored its photos could no longer be reached, so the album is hidden. If they reconnect their Drive during the grace period, it comes back.'
      : 'The flamekeeper who stored its photos left the initiative before they could be moved, so the photos were deleted.'
  const link = albumUrl ? `\n${albumUrl}` : ''
  return `Your album "${albumTitle}" is gone. ${why}${link}`
}
