import { describe, expect, it } from 'vitest'
import { buildPublicNoticeText } from '@/lib/albums/public-notice'

describe('buildPublicNoticeText', () => {
  it('names a single album and links to it', () => {
    const text = buildPublicNoticeText(
      [{ id: 'a1', title: 'Hike' }],
      'https://x.example/'
    )
    expect(text).toContain('Your album "Hike" is now public')
    expect(text).toContain('https://x.example/albums/a1')
  })

  it('lists several albums and links to the gallery', () => {
    const text = buildPublicNoticeText(
      [
        { id: 'a1', title: 'Hike' },
        { id: 'a2', title: 'Party' },
      ],
      'https://x.example'
    )
    expect(text).toContain('2 of your albums are now public')
    expect(text).toContain('- Hike')
    expect(text).toContain('- Party')
    expect(text).toContain('https://x.example/albums')
    expect(text).not.toContain('/albums/a1')
  })

  it('omits links when no origin is configured', () => {
    const text = buildPublicNoticeText([{ id: 'a1', title: 'Hike' }], '')
    expect(text).not.toContain('http')
  })

  it('caps the list and says how many more', () => {
    const albums = Array.from({ length: 15 }, (_, i) => ({
      id: `a${i}`,
      title: `T${i}`,
    }))
    const text = buildPublicNoticeText(albums, '')
    expect(text).toContain('15 of your albums')
    expect(text).toContain('- T9')
    expect(text).not.toContain('- T10')
    expect(text).toContain('and 5 more')
  })
})
