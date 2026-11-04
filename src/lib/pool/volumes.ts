export function rotateIds<T>(ids: T[], turn: number): T[] {
  if (ids.length === 0) return ids
  const start = ((Math.floor(turn) % ids.length) + ids.length) % ids.length
  return [...ids.slice(start), ...ids.slice(0, start)]
}

export function volumeFolderName(shortId: string): string {
  return `Volume ${shortId}`
}

export function albumBlockedAlertText(
  albumId: string,
  blocked: number
): string {
  if (blocked <= 0) {
    return `#savenuimg: album ${albumId} was deleted but its Drive folder could not be removed, so it may still hold public files that need manual cleanup.`
  }
  return `#savenuimg: album ${albumId} was deleted but ${blocked} of its volume subfolders could not be emptied, so its Drive folder may still hold public files that need manual cleanup.`
}

export function isInVolumeFolder(
  file: { trashed?: boolean; parents?: string[] },
  volumeFolderId: string | null
): boolean {
  return (
    !file.trashed &&
    !!volumeFolderId &&
    !!file.parents?.includes(volumeFolderId)
  )
}
