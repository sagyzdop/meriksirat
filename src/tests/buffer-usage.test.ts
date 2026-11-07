import { describe, expect, it } from 'vitest'
import {
  bufferBannerVisible,
  bufferUploadBlock,
  buildBufferOverview,
  effectiveLimitBytes,
  bufferUsageLevel,
  planBufferAlert,
  planUsageWrite,
  USAGE_REWRITE_MS,
  usagePercent,
} from '@/lib/buffer/usage'
import { BUFFER_FULL_MESSAGE } from '@/lib/buffer/messages'

const TB = 1024 ** 4
const LIMIT = 5 * TB

describe('bufferUsageLevel', () => {
  it('is ok below 90%', () => {
    expect(bufferUsageLevel({ usedBytes: 0, limitBytes: LIMIT }, 90)).toBe('ok')
    expect(
      bufferUsageLevel({ usedBytes: 0.899 * LIMIT, limitBytes: LIMIT }, 90)
    ).toBe('ok')
  })

  it('warns from exactly 90% up to just under 100%', () => {
    expect(
      bufferUsageLevel({ usedBytes: 0.9 * LIMIT, limitBytes: LIMIT }, 90)
    ).toBe('warn')
    expect(
      bufferUsageLevel({ usedBytes: LIMIT - 1, limitBytes: LIMIT }, 90)
    ).toBe('warn')
  })

  it('is full at 100% and beyond', () => {
    expect(bufferUsageLevel({ usedBytes: LIMIT, limitBytes: LIMIT }, 90)).toBe(
      'full'
    )
    expect(
      bufferUsageLevel({ usedBytes: LIMIT + TB, limitBytes: LIMIT }, 90)
    ).toBe('full')
  })

  it('treats an unknown or zero limit as ok', () => {
    expect(bufferUsageLevel({ usedBytes: TB, limitBytes: null }, 90)).toBe('ok')
    expect(bufferUsageLevel({ usedBytes: TB, limitBytes: 0 }, 90)).toBe('ok')
  })
})

describe('bufferUsageLevel alert percent', () => {
  it('uses the configured alert percent', () => {
    const usage = { usedBytes: 0.8 * LIMIT, limitBytes: LIMIT }
    expect(bufferUsageLevel(usage, 90)).toBe('ok')
    expect(bufferUsageLevel(usage, 75)).toBe('warn')
  })
})

describe('usagePercent', () => {
  it('rounds to a whole percent of the configured limit and caps at 100', () => {
    expect(usagePercent(0.456 * LIMIT, LIMIT)).toBe(46)
    expect(usagePercent(2 * LIMIT, LIMIT)).toBe(100)
    expect(usagePercent(TB, 0)).toBeNull()
  })
})

describe('effectiveLimitBytes', () => {
  it('is the smaller of the configured ceiling and the Drive quota', () => {
    expect(effectiveLimitBytes(LIMIT, 2 * LIMIT)).toBe(LIMIT)
    expect(effectiveLimitBytes(LIMIT, TB)).toBe(TB)
    expect(effectiveLimitBytes(LIMIT, null)).toBe(LIMIT)
  })
})

describe('buildBufferOverview', () => {
  const settings = { bufferLimitBytes: LIMIT, bufferAlertPercent: 90 }

  it('reports percent of the configured limit', () => {
    const overview = buildBufferOverview(
      { usedBytes: LIMIT / 2, limitBytes: 100 * TB },
      settings
    )
    expect(overview.percent).toBe(50)
    expect(overview.limitBytes).toBe(LIMIT)
    expect(overview.level).toBe('ok')
  })

  it('is full when the Drive quota is the smaller limit', () => {
    const overview = buildBufferOverview(
      { usedBytes: TB, limitBytes: TB },
      settings
    )
    expect(overview.limitBytes).toBe(TB)
    expect(overview.level).toBe('full')
    expect(overview.percent).toBe(20)
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
    expect(bufferUploadBlock({ level: 'full' })).toBe(BUFFER_FULL_MESSAGE)
  })

  it('allows uploads while there is room, or when usage is unknown', () => {
    expect(bufferUploadBlock({ level: 'warn' })).toBeNull()
    expect(bufferUploadBlock(null)).toBeNull()
  })
})

describe('planUsageWrite', () => {
  const stored = { usedBytes: 100, limitBytes: LIMIT, checkedAt: 1_000 }

  it('writes when nothing is stored or the usage changed', () => {
    expect(planUsageWrite(null, stored)).toBe(true)
    expect(planUsageWrite(stored, { ...stored, usedBytes: 101 })).toBe(true)
    expect(planUsageWrite(stored, { ...stored, limitBytes: null })).toBe(true)
  })

  it('skips an unchanged reading, then refreshes it before it ages out', () => {
    expect(planUsageWrite(stored, { ...stored, checkedAt: 2_000 })).toBe(false)
    expect(
      planUsageWrite(stored, {
        ...stored,
        checkedAt: stored.checkedAt + USAGE_REWRITE_MS,
      })
    ).toBe(true)
  })
})
