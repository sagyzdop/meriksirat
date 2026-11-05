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
    expect(resolvePledge('1')).toEqual({ ok: true, bytes: GB, gb: 1 })
    expect(resolvePledge('0.5')).toEqual({
      ok: true,
      bytes: MIN_PLEDGE_BYTES,
      gb: 0.5,
    })
    expect(resolvePledge('5')).toMatchObject({ ok: true, bytes: 5 * GB })
  })

  it('refuses anything that is not one of the six options', () => {
    for (const choice of ['0', '0.4', '2.5', '6', '12', '-3', 'abc', '']) {
      expect(resolvePledge(choice).ok).toBe(false)
    }
  })
})
