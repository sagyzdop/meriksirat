import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RUN_SUBREQUEST_BUDGET } from '@/lib/cron/budget'
import {
  CRON_SCHEDULES,
  planScheduledRun,
  type ScheduledRunPlan,
} from '@/lib/cron/schedule'

function plan(cron: string): ScheduledRunPlan {
  const result = planScheduledRun(cron)
  if (!result) throw new Error(`no plan for ${cron}`)
  return result
}

describe('planScheduledRun', () => {
  it('runs the booking steps every 5 minutes', () => {
    expect(plan(CRON_SCHEDULES.fiveMinutes).steps).toEqual([
      'cancelUnstartedBookings',
      'updateOverdueBookings',
      'sendBookingReminders',
    ])
  })

  it('runs the flamekeeper and album steps hourly', () => {
    expect(plan(CRON_SCHEDULES.hourly).steps).toEqual([
      'checkFlamekeeperHealth',
      'maintainPool',
      'drainFlamekeepers',
      'finishBans',
      'deleteScheduledAlbums',
      'checkBufferUsage',
      'switchBuffer',
    ])
  })

  it('runs graduation daily', () => {
    expect(plan(CRON_SCHEDULES.daily).steps).toEqual(['graduateFlamekeepers'])
  })

  it('runs every step on exactly one schedule', () => {
    const all = Object.values(CRON_SCHEDULES).flatMap((c) => plan(c).steps)
    expect(new Set(all).size).toBe(all.length)
  })

  it('no longer runs the removed steps', () => {
    const all: string[] = Object.values(CRON_SCHEDULES).flatMap(
      (c) => plan(c).steps
    )
    expect(all).not.toContain('notifyPublicAlbums')
    expect(all).not.toContain('cleanupStaleSignups')
    expect(all).not.toContain('backfillAlbumPhotos')
  })

  it('checks the bot configuration only on the hourly trigger', () => {
    expect(plan(CRON_SCHEDULES.hourly).configuresBot).toBe(true)
    expect(plan(CRON_SCHEDULES.fiveMinutes).configuresBot).toBe(false)
    expect(plan(CRON_SCHEDULES.daily).configuresBot).toBe(false)
  })

  it('ignores a cron string it does not know', () => {
    expect(planScheduledRun('*/7 * * * *')).toBeNull()
    expect(planScheduledRun('')).toBeNull()
    expect(planScheduledRun('toString')).toBeNull()
  })
})

describe('trigger budgets', () => {
  it('gives each trigger its own full budget', () => {
    const five = plan(CRON_SCHEDULES.fiveMinutes).budget
    const hourly = plan(CRON_SCHEDULES.hourly).budget
    five.spend(five.total)
    expect(five.remaining()).toBe(0)
    expect(hourly.remaining()).toBe(RUN_SUBREQUEST_BUDGET)
  })

  it('hands out a fresh budget on every run', () => {
    plan(CRON_SCHEDULES.daily).budget.spend(10)
    expect(plan(CRON_SCHEDULES.daily).budget.spent()).toBe(0)
  })
})

describe('wrangler.jsonc', () => {
  it('registers exactly the schedules the worker handles', () => {
    const text = readFileSync('wrangler.jsonc', 'utf8')
    const match = text.match(/"crons"\s*:\s*\[([^\]]*)\]/)
    const configured = [...(match?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(
      (m) => m[1]
    )
    expect(configured.sort()).toEqual(Object.values(CRON_SCHEDULES).sort())
  })
})
