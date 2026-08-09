/**
 * Photo URL helpers, shared between server and client.
 *
 * - Shared albums (`isShared`): the Drive folder is publicly readable, so
 *   images load directly from the Google CDN (`lh3.googleusercontent.com`).
 *   The `=w<size>` suffix resizes server-side for free.
 * - Private albums: images are streamed through the Worker proxy so only
 *   authenticated users with access can view them.
 */

export function driveCdnUrl(fileId: string, size?: number): string {
  return size
    ? `https://lh3.googleusercontent.com/d/${fileId}=w${size}`
    : `https://lh3.googleusercontent.com/d/${fileId}`
}

/**
 * Direct "download as attachment" URL for a publicly shared file. Google
 * serves it with `Content-Disposition: attachment`, so a plain anchor
 * downloads the file regardless of cross-origin (works in any tab, no blob).
 * Only valid while the album folder is shared (`isShared`).
 */
export function driveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
}

export function albumPhotoUrls(
  albumId: string,
  fileId: string,
  isShared: boolean
): { url: string; thumbnailUrl: string } {
  if (isShared) {
    return {
      url: driveCdnUrl(fileId),
      thumbnailUrl: driveCdnUrl(fileId, 600),
    }
  }
  return {
    url: `/api/drive-image/${albumId}/${fileId}`,
    thumbnailUrl: `/api/drive-image/${albumId}/${fileId}`,
  }
}

export function albumCoverUrl(
  albumId: string,
  fileId: string,
  isShared: boolean
): string {
  return isShared
    ? driveCdnUrl(fileId, 800)
    : `/api/drive-image/${albumId}/${fileId}`
}
