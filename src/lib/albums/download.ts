import { driveDownloadUrl } from './urls'
import type { AlbumPhoto } from './types'

/**
 * Download a single photo. Both branches use a plain anchor to a URL that the
 * server responds to with `Content-Disposition: attachment`, so the download
 * is handled by the browser's download manager (reliable, works from any tab,
 * no per-tab blob URLs).
 *
 * - Private albums are proxied through `/api/drive-image/...`; the worker
 *   streams the file with `?download=1` present.
 * - Public albums download straight from Google's `drive.usercontent` export
 *   endpoint, which does not consume the master account's Drive API quota.
 */
export async function downloadPhotoFile(photo: AlbumPhoto): Promise<void> {
  const href = photo.url.startsWith('/api/')
    ? `${photo.url}?download=1`
    : driveDownloadUrl(photo.id)

  const a = document.createElement('a')
  a.href = href
  a.download = photo.name
  a.referrerPolicy = 'no-referrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
