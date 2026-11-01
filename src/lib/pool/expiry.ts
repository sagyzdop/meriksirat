export const EXPIRY_YEARS = 2
export const REMINDER_WINDOWS_DAYS = { first: 30, second: 7 } as const

const DAY_MS = 24 * 60 * 60 * 1000

export type TombstoneReason =
  'expired' | 'flamekeeper_left' | 'flamekeeper_lost' | 'no_space'

export interface ExpiryAlbum {
  id: string
  expiresAt: Date | null
  pinned: boolean
  deletedAt: Date | null
  expiryReminder30SentAt: Date | null
  expiryReminder7SentAt: Date | null
}

export interface ExpiryPlan {
  expire: string[]
  remind30: string[]
  remind7: string[]
}

export function defaultExpiry(eventDate: Date): Date {
  const d = new Date(eventDate.getTime())
  d.setUTCFullYear(d.getUTCFullYear() + EXPIRY_YEARS)
  return d
}

function isLive(album: ExpiryAlbum): boolean {
  return !album.deletedAt && !album.pinned && !!album.expiresAt
}

export function planExpiry(albums: ExpiryAlbum[], now: Date): ExpiryPlan {
  const plan: ExpiryPlan = { expire: [], remind30: [], remind7: [] }
  const nowMs = now.getTime()
  for (const album of albums) {
    if (!isLive(album)) continue
    const left = album.expiresAt!.getTime() - nowMs
    if (left <= 0) {
      plan.expire.push(album.id)
    } else if (left <= REMINDER_WINDOWS_DAYS.second * DAY_MS) {
      if (!album.expiryReminder7SentAt) plan.remind7.push(album.id)
    } else if (left <= REMINDER_WINDOWS_DAYS.first * DAY_MS) {
      if (!album.expiryReminder30SentAt) plan.remind30.push(album.id)
    }
  }
  return plan
}

export function expiryBannerDate(
  album: Pick<ExpiryAlbum, 'expiresAt' | 'pinned' | 'deletedAt'>,
  now: Date
): Date | null {
  if (album.pinned || album.deletedAt || !album.expiresAt) return null
  const left = album.expiresAt.getTime() - now.getTime()
  if (left > REMINDER_WINDOWS_DAYS.first * DAY_MS) return null
  return album.expiresAt
}

export function tombstoneCopy(reason: TombstoneReason | null): {
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
    case 'no_space':
      return {
        title: 'This album is gone',
        description:
          'There was not enough storage left for these photos, so the album was removed to make room.',
      }
    default:
      return {
        title: 'This album has expired',
        description:
          'Albums are kept for two years after their event, and there is no backup copy. The photos have been deleted.',
      }
  }
}
