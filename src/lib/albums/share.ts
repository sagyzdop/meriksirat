import type { AlbumDetail, AlbumSummary } from './types'

/**
 * Public view link for an album.
 */
export function albumViewUrl(origin: string, albumId: string): string {
  return `${origin}/albums/${albumId}`
}

/**
 * Current app origin. On the client it is read from `window.location`; on the
 * server (SSR) it returns '' because the request URL is not importable from
 * client-safe modules. Callers that need `og:url` in server-rendered HTML can
 * omit it — Telegram builds previews from `og:title`/`og:description`/
 * `og:image` and uses the shared URL itself.
 */
export function getShareOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

/**
 * Build a ready-to-paste share message:
 *
 *   Name of the album
 *
 *   Description
 *
 *   by @user1, @user2
 *
 *   https://nuimg.sagyzdop.com/albums/qwerty12345
 *
 * Authors without a Telegram @username fall back to their display name. Empty
 * sections are omitted.
 */
export function albumShareText(
  album: AlbumSummary | AlbumDetail,
  origin: string
): string {
  const parts: string[] = []
  const title = album.title.trim()
  if (title) parts.push(title)

  const description = album.description?.trim()
  if (description) parts.push(description)

  if (album.authors.length > 0) {
    const authors = album.authors
      .map((a) => (a.telegramUsername ? `@${a.telegramUsername}` : a.name))
      .join(', ')
    parts.push(`by ${authors}`)
  }

  parts.push(albumViewUrl(origin, album.id))
  return parts.join('\n\n')
}
