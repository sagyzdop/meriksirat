import { describe, it, expect } from 'vitest'
import {
  buildGmailRaw,
  buildMimeMessage,
  encodeSubject,
} from '../lib/google/gmail-mime'

function decodeBase64Utf8(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return decodeBase64Utf8(padded)
}

describe('encodeSubject', () => {
  it('leaves printable ASCII subjects unencoded', () => {
    expect(encodeSubject('Test email from nu_image')).toBe(
      'Test email from nu_image'
    )
  })

  it('encodes non-ASCII subjects as RFC 2047 UTF-8 base64 words', () => {
    const encoded = encodeSubject('Жабаев: бронь')
    expect(encoded).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/)
    const payload = encoded.slice('=?UTF-8?B?'.length, -2)
    expect(decodeBase64Utf8(payload)).toBe('Жабаев: бронь')
  })

  it('splits long non-ASCII subjects into words under 76 chars without breaking characters', () => {
    const subject = '🔥'.repeat(30)
    const words = encodeSubject(subject).split('\r\n ')
    expect(words.length).toBeGreaterThan(1)
    for (const word of words) {
      expect(word.length).toBeLessThanOrEqual(75)
    }
    const decoded = words
      .map((word) => decodeBase64Utf8(word.slice('=?UTF-8?B?'.length, -2)))
      .join('')
    expect(decoded).toBe(subject)
  })

  it('strips line breaks to prevent header injection', () => {
    expect(encodeSubject('hi\r\nBcc: evil@example.com')).toBe(
      'hi Bcc: evil@example.com'
    )
  })
})

describe('buildMimeMessage', () => {
  it('builds a plain text message with base64 body', () => {
    const message = buildMimeMessage({
      to: 'member@example.com',
      subject: 'Hello',
      text: 'Hi there',
    })
    const [headerBlock, body] = message.split('\r\n\r\n')
    expect(headerBlock).toContain('To: member@example.com')
    expect(headerBlock).toContain('Subject: Hello')
    expect(headerBlock).toContain('MIME-Version: 1.0')
    expect(headerBlock).toContain('Content-Type: text/plain; charset=UTF-8')
    expect(headerBlock).toContain('Content-Transfer-Encoding: base64')
    expect(headerBlock).not.toContain('multipart')
    expect(decodeBase64Utf8(body)).toBe('Hi there')
  })

  it('wraps long base64 bodies at 76 characters', () => {
    const message = buildMimeMessage({
      to: 'a@example.com',
      subject: 'Long',
      text: 'x'.repeat(500),
    })
    const body = message.split('\r\n\r\n')[1]
    for (const line of body.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(76)
    }
  })

  it('builds multipart/alternative with plain text before html when html is given', () => {
    const message = buildMimeMessage({
      to: 'member@example.com',
      subject: 'Hello',
      text: 'plain body',
      html: '<p>html body</p>',
    })
    expect(message).toContain(
      'Content-Type: multipart/alternative; boundary="nu-image-alt-boundary"'
    )

    const parts = message
      .split('--nu-image-alt-boundary')
      .slice(1, 3)
      .map((part) => part.trim().split('\r\n\r\n'))
    expect(parts[0][0]).toContain('Content-Type: text/plain; charset=UTF-8')
    expect(decodeBase64Utf8(parts[0][1])).toBe('plain body')
    expect(parts[1][0]).toContain('Content-Type: text/html; charset=UTF-8')
    expect(decodeBase64Utf8(parts[1][1])).toBe('<p>html body</p>')
    expect(message.endsWith('--nu-image-alt-boundary--')).toBe(true)
  })
})

describe('buildGmailRaw', () => {
  it('returns base64url with no +, / or = characters', () => {
    const raw = buildGmailRaw({
      to: 'member@example.com',
      subject: 'Тест ???>>>',
      text: 'ÿþ?>>> payload that forces + and / characters',
      html: '<p>ünïcödé</p>',
    })
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('round-trips back to the original RFC 2822 message', () => {
    const content = {
      to: 'member@example.com',
      subject: 'Привет',
      text: 'Hello ünïcödé',
    }
    expect(decodeBase64Url(buildGmailRaw(content))).toBe(
      buildMimeMessage(content)
    )
  })
})
