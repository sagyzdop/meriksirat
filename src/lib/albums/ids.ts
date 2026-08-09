const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Generate a URL-safe opaque identifier. Album ids are 10 chars, share tokens
 * 24 chars. Collision risk is negligible.
 */
export function newId(len: number): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

export const newAlbumId = () => newId(10)
export const newShareToken = () => newId(24)
