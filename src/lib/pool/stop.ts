import type { FlamekeeperState } from '@/lib/access/access-rules'

export type StopReason = 'opt_out' | 'graduation' | 'domain' | 'ban'

export interface StoppableFlamekeeper {
  state: FlamekeeperState
}

export type StopPlan =
  { kind: 'stop' } | { kind: 'none' } | { kind: 'refuse'; message: string }

export function planOptOut(fk: StoppableFlamekeeper): StopPlan {
  if (fk.state === 'drained') {
    return { kind: 'refuse', message: 'You have already stopped flamekeeping' }
  }
  return { kind: 'stop' }
}

export function planBan(fk: StoppableFlamekeeper | null): StopPlan {
  return !fk || fk.state === 'drained' ? { kind: 'none' } : { kind: 'stop' }
}

export function planEnd(heldVolumes: number): 'draining' | 'drained' {
  return heldVolumes > 0 ? 'draining' : 'drained'
}
