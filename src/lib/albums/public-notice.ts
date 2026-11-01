const MAX_LISTED = 10

export interface PublicNoticeAlbum {
  id: string
  title: string
}

export function buildPublicNoticeText(
  albums: PublicNoticeAlbum[],
  origin: string
): string {
  const base = origin.trim().replace(/\/+$/, '')
  if (albums.length === 1) {
    const [only] = albums
    const link = base ? `\n${base}/albums/${only.id}` : ''
    return `Your album "${only.title}" is now public and listed in the gallery. Anyone with the link could already open its Drive folder, so nothing else changes.${link}`
  }
  const listed = albums
    .slice(0, MAX_LISTED)
    .map((a) => `- ${a.title}`)
    .join('\n')
  const more =
    albums.length > MAX_LISTED ? `\nand ${albums.length - MAX_LISTED} more` : ''
  const link = base ? `\n${base}/albums` : ''
  return `${albums.length} of your albums are now public and listed in the gallery:\n${listed}${more}\nAnyone with the link could already open their Drive folders, so nothing else changes.${link}`
}
