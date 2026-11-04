import { describe, expect, it } from 'vitest'
import {
  bufferBannerVisible,
  bufferUploadBlock,
  bufferUsageLevel,
  planBufferAlert,
  usagePercent,
} from '@/lib/buffer/usage'
import { BUFFER_FULL_MESSAGE } from '@/lib/buffer/messages'

const TB = 1024 ** 4
const LIMIT = 5 * TB

describe('bufferUsageLevel', () => {
  it('is ok below 90%', () => {
    expect(bufferUsageLevel({ usedBytes: 0, limitBytes: LIMIT })).toBe('ok')
    expect(
      bufferUsageLevel({ usedBytes: 0.899 * LIMIT, limitBytes: LIMIT })
    ).toBe('ok')
  })

  it('warns from exactly 90% up to just under 100%', () => {
    expect(
      bufferUsageLevel({ usedBytes: 0.9 * LIMIT, limitBytes: LIMIT })
    ).toBe('warn')
    expect(bufferUsageLevel({ usedBytes: LIMIT - 1, limitBytes: LIMIT })).toBe(
      'warn'
    )
  })

  it('is full at 100% and beyond', () => {
    expect(bufferUsageLevel({ usedBytes: LIMIT, limitBytes: LIMIT })).toBe(
      'full'
    )
    expect(bufferUsageLevel({ usedBytes: LIMIT + TB, limitBytes: LIMIT })).toBe(
      'full'
    )
  })

  it('treats an unknown or zero limit as ok', () => {
    expect(bufferUsageLevel({ usedBytes: TB, limitBytes: null })).toBe('ok')
    expect(bufferUsageLevel({ usedBytes: TB, limitBytes: 0 })).toBe('ok')
  })
})

describe('usagePercent', () => {
  it('rounds to a whole percent and caps at 100', () => {
    expect(usagePercent({ usedBytes: 0.456 * LIMIT, limitBytes: LIMIT })).toBe(
      46
    )
    expect(usagePercent({ usedBytes: 2 * LIMIT, limitBytes: LIMIT })).toBe(100)
    expect(usagePercent({ usedBytes: TB, limitBytes: null })).toBeNull()
  })
})

describe('planBufferAlert', () => {
  it('alerts on the first crossing of 90%', () => {
    expect(planBufferAlert('warn', null)).toEqual({
      notify: true,
      marker: 'warn',
    })
  })

  it('does not repeat while usage stays above 90%', () => {
    expect(planBufferAlert('warn', 'warn')).toEqual({
      notify: false,
      marker: 'warn',
    })
    expect(planBufferAlert('full', 'full')).toEqual({
      notify: false,
      marker: 'full',
    })
  })

  it('alerts again when usage reaches 100%', () => {
    expect(planBufferAlert('full', 'warn')).toEqual({
      notify: true,
      marker: 'full',
    })
    expect(planBufferAlert('full', null)).toEqual({
      notify: true,
      marker: 'full',
    })
  })

  it('stays quiet when space is freed from full back to warn', () => {
    expect(planBufferAlert('warn', 'full')).toEqual({
      notify: false,
      marker: 'warn',
    })
  })

  it('re-arms once usage drops below 90%, so the next crossing alerts', () => {
    expect(planBufferAlert('ok', 'warn')).toEqual({
      notify: false,
      marker: null,
    })
    expect(planBufferAlert('warn', null).notify).toBe(true)
  })

  it('does nothing while ok and never alerted', () => {
    expect(planBufferAlert('ok', null)).toEqual({
      notify: false,
      marker: null,
    })
  })
})

describe('bufferBannerVisible', () => {
  it('shows to @nu.edu.kz users at 90% and over', () => {
    expect(bufferBannerVisible('a@nu.edu.kz', 'warn')).toBe(true)
    expect(bufferBannerVisible('A@NU.edu.kz', 'full')).toBe(true)
  })

  it('hides below 90%', () => {
    expect(bufferBannerVisible('a@nu.edu.kz', 'ok')).toBe(false)
  })

  it('hides from alumni and other domains', () => {
    expect(bufferBannerVisible('a@alumni.nu.edu.kz', 'warn')).toBe(false)
    expect(bufferBannerVisible('a@gmail.com', 'full')).toBe(false)
  })
})

describe('bufferUploadBlock', () => {
  it('refuses uploads at 100% with the full message', () => {
    expect(bufferUploadBlock({ usedBytes: LIMIT, limitBytes: LIMIT })).toBe(
      BUFFER_FULL_MESSAGE
    )
  })

  it('allows uploads while there is room, or when usage is unknown', () => {
    expect(
      bufferUploadBlock({ usedBytes: 0.95 * LIMIT, limitBytes: LIMIT })
    ).toBeNull()
    expect(bufferUploadBlock(null)).toBeNull()
  })
})
