const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GROUP_SIZE = 4
const GROUPS = 2

export function generateClubCode(): string {
  const bytes = new Uint8Array(GROUP_SIZE * GROUPS)
  crypto.getRandomValues(bytes)
  const chars = Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]
  )
  const groups: string[] = []
  for (let i = 0; i < chars.length; i += GROUP_SIZE) {
    groups.push(chars.slice(i, i + GROUP_SIZE).join(''))
  }
  return groups.join('-')
}
