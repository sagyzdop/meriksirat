import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLEDGE_CHOICE,
  PLEDGE_CHOICES,
  resolvePledge,
} from '../lib/flamekeeper/pledge'
import { GB, MIN_PLEDGE_BYTES } from '../lib/flamekeeper/rules'

describe('pledge choices', () => {
  it('offers 512 MB, then 1 to 5 GB, with 1 GB selected', () => {
    expect(PLEDGE_CHOICES.map((c) => c.label)).toEqual([
      '512 MB',
      '1 GB',
      '2 GB',
      '3 GB',
      '4 GB',
      '5 GB',
    ])
    expect(DEFAULT_PLEDGE_CHOICE).toBe('1')
  })
})

describe('resolvePledge', () => {
  it('turns the selected button into bytes', () => {
    expect(resolvePledge('1', '')).toEqual({ ok: true, bytes: GB, gb: 1 })
    expect(resolvePledge('0.5', '')).toEqual({
      ok: true,
      bytes: MIN_PLEDGE_BYTES,
      gb: 0.5,
    })
    expect(resolvePledge('5', '')).toMatchObject({ ok: true, bytes: 5 * GB })
  })

  it('prefers a typed amount over the selected button', () => {
    expect(resolvePledge('1', '12')).toEqual({
      ok: true,
      bytes: 12 * GB,
      gb: 12,
    })
  })

  it('accepts a typed amount down to exactly 512 MB', () => {
    expect(resolvePledge('1', '0.5')).toMatchObject({ ok: true })
  })

  it('refuses a typed amount below 512 MB', () => {
    const result = resolvePledge('1', '0.4')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/512 MB/)
  })

  it('refuses zero, negative, junk and too-large amounts', () => {
    for (const typed of ['0', '-3', 'abc', '1e9', '5000']) {
      expect(resolvePledge('1', typed).ok).toBe(false)
    }
  })

  it('refuses when nothing is chosen', () => {
    expect(resolvePledge('', '').ok).toBe(false)
  })
})
