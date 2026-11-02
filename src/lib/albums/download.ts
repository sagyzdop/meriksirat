import { driveDownloadUrl } from './urls'
import type { AlbumPhoto } from './types'

export async function downloadPhotoFile(photo: AlbumPhoto): Promise<void> {
  const href = driveDownloadUrl(photo.id)

  const a = document.createElement('a')
  a.href = href
  // No `download` attribute: ignored for cross-origin URLs, and Google serves
  // this endpoint with Content-Disposition: attachment anyway.
  a.referrerPolicy = 'no-referrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
