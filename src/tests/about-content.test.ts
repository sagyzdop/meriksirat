import { describe, it, expect } from 'vitest'
import { formatMinPledge } from '../lib/about/content'
import { postLoginPath } from '../lib/access/access-rules'
import { guestHtmlTtlSeconds } from '../lib/cache/guest-html'

describe('postLoginPath', () => {
  const member = { isMember: true, onboardingComplete: true }

  it('follows a same-origin redirect after login', () => {
    expect(postLoginPath(member, '/become-flamekeeper')).toBe(
      '/become-flamekeeper'
    )
  })

  it('falls back to home for missing or off-site redirects', () => {
    expect(postLoginPath(member, undefined)).toBe('/equipment')
    expect(postLoginPath(member, 'https://evil.example')).toBe('/equipment')
    expect(postLoginPath(member, '//evil.example')).toBe('/equipment')
    expect(postLoginPath(member, '/\\evil.example')).toBe('/equipment')
    expect(postLoginPath(member, '/login')).toBe('/equipment')
  })

  it('sends members who still need onboarding there first', () => {
    expect(
      postLoginPath({ isMember: true, onboardingComplete: false }, '/x')
    ).toBe('/onboarding')
  })
})

describe('formatMinPledge', () => {
  it('shows whole gigabytes and sub-gigabyte pledges in MB', () => {
    expect(formatMinPledge(1024 ** 3)).toBe('1 GB')
    expect(formatMinPledge(512 * 1024 ** 2)).toBe('512 MB')
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
    expect(guestHtmlTtlSeconds('/account')).toBeNull()
    expect(guestHtmlTtlSeconds('/about/x')).toBeNull()
  })
})
