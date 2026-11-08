const ENCODER = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(secret: string): Promise<CryptoKey> {
  if (!secret.trim()) throw new Error('BUFFER_ENCRYPTION_KEY not set')
  const digest = await crypto.subtle.digest('SHA-256', ENCODER.encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptToken(
  plain: string,
  secret: string
): Promise<string> {
  const key = await importKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      ENCODER.encode(plain)
    )
  )
  return `${toBase64(iv)}.${toBase64(cipher)}`
}

export async function decryptToken(
  stored: string,
  secret: string
): Promise<string> {
  const [iv, cipher] = stored.split('.')
  if (!iv || !cipher) throw new Error('Stored buffer token is malformed')
  const key = await importKey(secret)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(cipher)
  )
  return new TextDecoder().decode(plain)
}
