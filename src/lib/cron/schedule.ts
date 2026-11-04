import { createBudget, type Budget } from './budget'

export const CRON_SCHEDULES = {
  fiveMinutes: '*/5 * * * *',
  hourly: '0 * * * *',
  daily: '0 3 * * *',
} as const

export type CronStepName =
  | 'cancelUnstartedBookings'
  | 'updateOverdueBookings'
  | 'sendBookingReminders'
  | 'checkFlamekeeperHealth'
  | 'maintainPool'
  | 'drainFlamekeepers'
  | 'finishBans'
  | 'expireAlbums'
  | 'checkBufferUsage'
  | 'graduateFlamekeepers'

export interface ScheduledRunPlan {
  steps: CronStepName[]
  budget: Budget
  configuresBot: boolean
}

const GROUPS: Record<
  string,
  { steps: CronStepName[]; configuresBot: boolean }
> = {
  [CRON_SCHEDULES.fiveMinutes]: {
    steps: [
      'cancelUnstartedBookings',
      'updateOverdueBookings',
      'sendBookingReminders',
    ],
    configuresBot: false,
  },
  [CRON_SCHEDULES.hourly]: {
    steps: [
      'checkFlamekeeperHealth',
      'maintainPool',
      'drainFlamekeepers',
      'finishBans',
      'expireAlbums',
      'checkBufferUsage',
    ],
    configuresBot: true,
  },
  [CRON_SCHEDULES.daily]: {
    steps: ['graduateFlamekeepers'],
    configuresBot: false,
  },
}

export function planScheduledRun(cron: string): ScheduledRunPlan | null {
  const group = Object.hasOwn(GROUPS, cron) ? GROUPS[cron] : undefined
  if (!group) return null
  return {
    steps: [...group.steps],
    configuresBot: group.configuresBot,
    budget: createBudget(),
  }
}
