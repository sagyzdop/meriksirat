import { driveDownloadUrl } from './urls'
import type { AlbumPhoto } from './types'

/**
 * Download a single photo. Every album folder is public in Drive, so the
 * download is a plain anchor to Google's `drive.usercontent` export endpoint,
 * which responds with `Content-Disposition: attachment` and does not consume
 * the master account's Drive API quota. The browser's download manager handles
 * it (reliable, works from any tab, no per-tab blob URLs).
 */
export async function downloadPhotoFile(photo: AlbumPhoto): Promise<void> {
  const href = driveDownloadUrl(photo.id)

  const a = document.createElement('a')
  a.href = href
  // No `download` attribute: browsers ignore it for cross-origin URLs and log
  // a console warning. Google serves this endpoint with
  // `Content-Disposition: attachment` anyway.
  a.referrerPolicy = 'no-referrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
