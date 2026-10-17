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

/**
 * The album's folder in the Drive web UI, where Drive's own Download button
 * zips the whole folder server-side.
 *
 * This is the only route to a full-size zip of an album. Drive's API has no
 * folder-zip method, and the `drive.usercontent` export endpoint rejects a
 * folder id anonymously (HTTP 500), so zipping has to happen on Drive's side
 * behind a signed-in session. Doing it ourselves would mean pushing ~1.1 GB of
 * full-size originals (100 photos x 11 MB) through the user's browser at the
 * ~1 MB/s that CDN serves them, which takes ~20 minutes.
 */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export function albumPhotoUrls(fileId: string): {
  url: string
  thumbnailUrl: string
} {
  return {
    url: driveCdnUrl(fileId, 1920),
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
