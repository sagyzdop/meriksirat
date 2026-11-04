import { describe, it, expect } from 'vitest'
import {
  aboutCopy,
  becomeFlamekeeperPath,
  formatMinPledge,
} from '../lib/about/content'
import { guestHtmlTtlSeconds } from '../lib/cache/guest-html'
import { MIN_PLEDGE_BYTES } from '../lib/flamekeeper/rules'

describe('become a flamekeeper button', () => {
  it('sends signed-in visitors to the sign-up and signed-out ones to login', () => {
    expect(becomeFlamekeeperPath(true)).toBe('/profile')
    expect(becomeFlamekeeperPath(false)).toBe('/login')
  })
})

describe('formatMinPledge', () => {
  it('shows whole gigabytes and sub-gigabyte pledges in MB', () => {
    expect(formatMinPledge(1024 ** 3)).toBe('1 GB')
    expect(formatMinPledge(512 * 1024 ** 2)).toBe('512 MB')
  })
})

describe('about copy', () => {
  const text = JSON.stringify(aboutCopy())

  it('states the minimum pledge the code enforces', () => {
    expect(text).toContain(formatMinPledge(MIN_PLEDGE_BYTES))
  })

  it('states the album lifetime and reminder days the code uses', () => {
    expect(text).toContain('two years')
    expect(text).toContain('30 and 7 days')
  })
})

describe('guest html cache ttl', () => {
  it('caches the about page far longer than album pages', () => {
    const about = guestHtmlTtlSeconds('/about')
    const album = guestHtmlTtlSeconds('/albums/abc')
    expect(about).toBeGreaterThan(album!)
    expect(guestHtmlTtlSeconds('/albums')).toBe(album)
  })

  it('does not cache other paths', () => {
    expect(guestHtmlTtlSeconds('/profile')).toBeNull()
    expect(guestHtmlTtlSeconds('/about/x')).toBeNull()
  })
})
