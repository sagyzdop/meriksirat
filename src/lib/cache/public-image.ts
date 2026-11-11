const PUBLIC_IMAGE = /^\/api\/images\/(equipment-images\/[\w.-]+)$/

/**
 * The R2 key of a public image request, or null. Only equipment photos are
 * public; their keys carry the upload time, so a key never changes content
 * and the response can be cached for good.
 */
export function publicImageKey(pathname: string): string | null {
  const match = PUBLIC_IMAGE.exec(pathname)
  if (!match || match[1].includes('..')) return null
  return match[1]
}

export const PUBLIC_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
