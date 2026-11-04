import { describe, expect, it } from 'vitest'
import type { FlamekeeperState } from '@/lib/access/access-rules'
import {
  graduationStopStart,
  planDomainChange,
  planGraduation,
} from '@/lib/pool/graduation'
import { planBan, planOptOut } from '@/lib/pool/stop'

const NOW = new Date('2026-11-01T10:00:00Z')
const fk = (state: FlamekeeperState) => ({ state })
const LIVE = ['active', 'full', 'draining', 'lost'] as const

describe('planOptOut', () => {
  it.each(LIVE)('ends a %s flamekeeper at once', (state) => {
    expect(planOptOut(fk(state))).toEqual({ kind: 'stop' })
  })

  it('refuses someone who already stopped', () => {
    expect(planOptOut(fk('drained'))).toEqual({
      kind: 'refuse',
      message: 'You have already stopped flamekeeping',
    })
  })
})

describe('planBan', () => {
  it('does nothing for a user who is not a flamekeeper', () => {
    expect(planBan(null)).toEqual({ kind: 'none' })
  })

  it.each(LIVE)('ends a %s flamekeeper at once', (state) => {
    expect(planBan(fk(state))).toEqual({ kind: 'stop' })
  })

  it('leaves a flamekeeper who already stopped alone', () => {
    expect(planBan(fk('drained'))).toEqual({ kind: 'none' })
  })
})

describe('graduationStopStart', () => {
  it('is 60 days before the graduation date', () => {
    expect(graduationStopStart('2027-01-01').toISOString()).toBe(
      '2026-11-02T00:00:00.000Z'
    )
  })
})

describe('planGraduation', () => {
  it('does nothing more than 60 days out', () => {
    expect(planGraduation(fk('active'), '2027-01-02', NOW)).toEqual({
      kind: 'none',
    })
  })

  it.each(LIVE)('ends a %s flamekeeper once within 60 days', (state) => {
    expect(planGraduation(fk(state), '2026-12-31', NOW)).toEqual({
      kind: 'stop',
    })
  })

  it('ends a flamekeeper whose date has already passed', () => {
    expect(planGraduation(fk('active'), '2026-06-01', NOW)).toEqual({
      kind: 'stop',
    })
  })

  it('leaves a flamekeeper who already stopped alone', () => {
    expect(planGraduation(fk('drained'), '2026-06-01', NOW)).toEqual({
      kind: 'none',
    })
  })
})

describe('planDomainChange', () => {
  it('ignores nu.edu.kz addresses', () => {
    expect(planDomainChange(fk('active'), 'a@nu.edu.kz')).toEqual({
      kind: 'none',
    })
  })

  it.each(LIVE)('ends a %s flamekeeper who moved to alumni mail', (state) => {
    expect(planDomainChange(fk(state), 'a@gmail.com')).toEqual({
      kind: 'stop',
    })
  })

  it('leaves a flamekeeper who already stopped alone', () => {
    expect(planDomainChange(fk('drained'), 'a@gmail.com')).toEqual({
      kind: 'none',
    })
  })
})
