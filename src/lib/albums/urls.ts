export function driveCdnUrl(fileId: string, size?: number): string {
  return size
    ? `https://lh3.googleusercontent.com/d/${fileId}=w${size}`
    : `https://lh3.googleusercontent.com/d/${fileId}`
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`
}

/**
 * Drive's API has no folder-zip method and the export endpoint rejects a
 * folder id anonymously, so the only full-size zip is Drive's own Download
 * button in the web UI.
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

export function albumCoverSrcSet(fileId: string): string {
  return [400, 600, 800]
    .map((w) => `${driveCdnUrl(fileId, w)} ${w}w`)
    .join(', ')
}

export function albumOgImageUrl(fileId: string): string {
  return driveCdnUrl(fileId, 1200)
}
