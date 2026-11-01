const DAY_MS = 24 * 60 * 60 * 1000

export const EARLY_EXPIRY_NOTICE_DAYS = 7

export interface SuggestionAlbum {
  id: string
  expiresAt: Date | null
  pinned: boolean
  deletedAt: Date | null
  favoriteCount: number
  photoBytes: number
}

export function suggestDeletions<T extends SuggestionAlbum>(albums: T[]): T[] {
  const far = Number.MAX_SAFE_INTEGER
  return albums
    .filter((a) => !a.deletedAt && !a.pinned)
    .sort((a, b) => {
      const groupA = a.favoriteCount > 0 ? 1 : 0
      const groupB = b.favoriteCount > 0 ? 1 : 0
      if (groupA !== groupB) return groupA - groupB
      const expA = a.expiresAt?.getTime() ?? far
      const expB = b.expiresAt?.getTime() ?? far
      if (expA !== expB) return expA - expB
      return b.photoBytes - a.photoBytes
    })
}

export function earlyExpiryDate(now: Date): Date {
  return new Date(now.getTime() + EARLY_EXPIRY_NOTICE_DAYS * DAY_MS)
}

export function canExpireEarly(
  album: Pick<SuggestionAlbum, 'deletedAt' | 'pinned' | 'expiresAt'>,
  now: Date
): boolean {
  if (album.deletedAt || album.pinned) return false
  const target = earlyExpiryDate(now).getTime()
  return !album.expiresAt || album.expiresAt.getTime() > target
}

export interface NoticeUser {
  id: string
  email: string
  telegramChatId: string | null
}

export interface NoticeRecipient extends NoticeUser {
  role: 'owner' | 'favoriter'
  channel: 'telegram' | 'email'
}

export function planEarlyExpiryNotices(
  ownerId: string,
  users: NoticeUser[]
): NoticeRecipient[] {
  const seen = new Set<string>()
  const result: NoticeRecipient[] = []
  const ordered = [
    ...users.filter((u) => u.id === ownerId),
    ...users.filter((u) => u.id !== ownerId),
  ]
  for (const u of ordered) {
    if (seen.has(u.id)) continue
    seen.add(u.id)
    result.push({
      ...u,
      role: u.id === ownerId ? 'owner' : 'favoriter',
      channel: u.telegramChatId ? 'telegram' : 'email',
    })
  }
  return result
}
