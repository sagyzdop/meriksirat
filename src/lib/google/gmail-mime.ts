const CRLF = '\r\n'
const BOUNDARY = 'nu-image-alt-boundary'
const MAX_BASE64_LINE = 76
const ENCODED_WORD_CHUNK_BYTES = 45

const utf8 = new TextEncoder()

export interface EmailContent {
  to: string
  subject: string
  text: string
  html?: string
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function base64Body(text: string): string {
  const encoded = toBase64(utf8.encode(text))
  const lines: string[] = []
  for (let i = 0; i < encoded.length; i += MAX_BASE64_LINE) {
    lines.push(encoded.slice(i, i + MAX_BASE64_LINE))
  }
  return lines.join(CRLF)
}

export function encodeSubject(subject: string): string {
  const clean = stripLineBreaks(subject)
  if (/^[\x20-\x7e]*$/.test(clean)) return clean

  const chunks: string[] = []
  let current = ''
  let currentBytes = 0
  for (const char of clean) {
    const size = utf8.encode(char).length
    if (currentBytes + size > ENCODED_WORD_CHUNK_BYTES) {
      chunks.push(current)
      current = ''
      currentBytes = 0
    }
    current += char
    currentBytes += size
  }
  if (current) chunks.push(current)

  return chunks
    .map((chunk) => `=?UTF-8?B?${toBase64(utf8.encode(chunk))}?=`)
    .join(`${CRLF} `)
}

export function buildMimeMessage({
  to,
  subject,
  text,
  html,
}: EmailContent): string {
  const headers = [
    `To: ${stripLineBreaks(to)}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
  ]

  if (html === undefined) {
    return [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Body(text),
    ].join(CRLF)
  }

  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${BOUNDARY}"`,
    '',
    `--${BOUNDARY}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(text),
    `--${BOUNDARY}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(html),
    `--${BOUNDARY}--`,
  ].join(CRLF)
}

export function buildGmailRaw(content: EmailContent): string {
  return toBase64(utf8.encode(buildMimeMessage(content)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
