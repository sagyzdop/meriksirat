import { isNuEmail } from '@/lib/flamekeeper/rules'
import {
  planPledgeChange,
  startDrain,
  type DrainFlamekeeper,
  type DrainTransition,
} from './drain'

const DAY_MS = 24 * 60 * 60 * 1000

export const GRADUATION_LEAD_DAYS = 60
export const GRADUATION_CONFIRM_DAYS = 365

export function graduationDrainStart(graduationDate: string): Date {
  return new Date(
    new Date(`${graduationDate}T00:00:00Z`).getTime() -
      GRADUATION_LEAD_DAYS * DAY_MS
  )
}

export function graduationDrainDue(graduationDate: string, now: Date): boolean {
  const start = graduationDrainStart(graduationDate)
  return !Number.isNaN(start.getTime()) && now.getTime() >= start.getTime()
}

/**
 * Graduation trigger. Starts a full drain 60 days before the graduation
 * date; a lowered-pledge drain is widened to a full one. Moving the date out
 * of the window cancels a graduation drain.
 */
export function planGraduation(
  fk: DrainFlamekeeper,
  graduationDate: string,
  now: Date,
  hasPhotos: boolean = fk.usedBytes > 0
): DrainTransition {
  const due = graduationDrainDue(graduationDate, now)
  switch (fk.state) {
    case 'active':
    case 'full':
      if (!due) return { kind: 'none' }
      return hasPhotos ? startDrain('graduation', now) : { kind: 'drained' }
    case 'draining':
      if (fk.drainReason === 'graduation') {
        return due ? { kind: 'none' } : { kind: 'resume' }
      }
      if (fk.drainReason === 'pledge' && due) {
        return startDrain('graduation', now)
      }
      return { kind: 'none' }
    default:
      return { kind: 'none' }
  }
}

/**
 * Domain trigger. A flamekeeper whose account email is no longer
 * `@nu.edu.kz` (for example after the move to alumni) drains immediately.
 */
export function planDomainChange(
  fk: DrainFlamekeeper,
  email: string,
  now: Date,
  hasPhotos: boolean = fk.usedBytes > 0
): DrainTransition {
  if (isNuEmail(email)) return { kind: 'none' }
  switch (fk.state) {
    case 'active':
    case 'full':
      return hasPhotos ? startDrain('domain', now) : { kind: 'drained' }
    case 'draining':
      if (fk.drainReason === 'pledge' || fk.drainReason === 'graduation') {
        return startDrain('domain', now)
      }
      return { kind: 'none' }
    default:
      return { kind: 'none' }
  }
}

/**
 * Editing the pledge and graduation date together: a graduation drain wins
 * over a pledge drain, and cancelling a graduation drain still honours a
 * pledge that sits below what is held.
 */
export function planFlamekeeperEdit(
  fk: DrainFlamekeeper,
  input: { pledgedBytes: number; graduationDate: string },
  now: Date,
  hasPhotos: boolean = fk.usedBytes > 0
): DrainTransition {
  const graduation = planGraduation(fk, input.graduationDate, now, hasPhotos)
  if (graduation.kind === 'resume') {
    const pledge = planPledgeChange(
      { ...fk, state: 'active', drainReason: null },
      input.pledgedBytes,
      now
    )
    return pledge.kind === 'drain' ? pledge : graduation
  }
  if (graduation.kind !== 'none') return graduation
  return planPledgeChange(fk, input.pledgedBytes, now)
}

export interface GraduationConfirmState {
  state: DrainFlamekeeper['state']
  createdAt: Date
  graduationConfirmedAt: Date | null
  graduationPromptSentAt: Date | null
}

export function graduationConfirmDueAt(fk: GraduationConfirmState): Date {
  const last = fk.graduationConfirmedAt ?? fk.createdAt
  return new Date(last.getTime() + GRADUATION_CONFIRM_DAYS * DAY_MS)
}

/** The yearly prompt shown on the account page. */
export function graduationConfirmDue(
  fk: GraduationConfirmState,
  now: Date
): boolean {
  if (fk.state === 'drained' || fk.state === 'lost') return false
  return now.getTime() >= graduationConfirmDueAt(fk).getTime()
}

/** One reminder email per confirmation cycle. */
export function graduationPromptEmailDue(
  fk: GraduationConfirmState,
  now: Date
): boolean {
  if (!graduationConfirmDue(fk, now)) return false
  if (fk.state === 'draining') return false
  return (
    !fk.graduationPromptSentAt ||
    fk.graduationPromptSentAt.getTime() < graduationConfirmDueAt(fk).getTime()
  )
}
