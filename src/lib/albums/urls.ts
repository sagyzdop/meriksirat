/**
 * Photo URL helpers, shared between server and client.
 *
 * Every album folder is public in Google Drive (anyone reader), so photos are
 * always served directly from the Google CDN (`lh3.googleusercontent.com`).
 * The `=w<size>` suffix resizes server-side for free. There is no Worker proxy
 * and no per-album access check at image-load time.
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
 */
export function driveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
}

export function albumPhotoUrls(fileId: string): {
  url: string
  thumbnailUrl: string
} {
  return {
    url: driveCdnUrl(fileId),
    thumbnailUrl: driveCdnUrl(fileId, 600),
  }
}

export function albumCoverUrl(fileId: string): string {
  return driveCdnUrl(fileId, 800)
}

/**
 * Larger cover variant used for Open Graph / Telegram link previews. Uses the
 * `=w1200` server-side resize so preview cards get a hi-res image for free.
 */
export function albumOgImageUrl(fileId: string): string {
  return driveCdnUrl(fileId, 1200)
}
