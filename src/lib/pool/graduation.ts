import { isNuEmail } from '@/lib/flamekeeper/rules'
import type { StopPlan, StoppableFlamekeeper } from './stop'

const DAY_MS = 24 * 60 * 60 * 1000

export const GRADUATION_LEAD_DAYS = 60
export const GRADUATION_CONFIRM_DAYS = 365

export function graduationStopStart(graduationDate: string): Date {
  return new Date(
    new Date(`${graduationDate}T00:00:00Z`).getTime() -
      GRADUATION_LEAD_DAYS * DAY_MS
  )
}

export function graduationStopDue(graduationDate: string, now: Date): boolean {
  const start = graduationStopStart(graduationDate)
  return !Number.isNaN(start.getTime()) && now.getTime() >= start.getTime()
}

export function planGraduation(
  fk: StoppableFlamekeeper,
  graduationDate: string,
  now: Date
): StopPlan {
  if (fk.state === 'drained') return { kind: 'none' }
  return graduationStopDue(graduationDate, now)
    ? { kind: 'stop' }
    : { kind: 'none' }
}

export function planDomainChange(
  fk: StoppableFlamekeeper,
  email: string
): StopPlan {
  if (isNuEmail(email) || fk.state === 'drained') return { kind: 'none' }
  return { kind: 'stop' }
}

export interface GraduationConfirmState {
  state: StoppableFlamekeeper['state']
  createdAt: Date
  graduationConfirmedAt: Date | null
  graduationPromptSentAt: Date | null
}

export function graduationConfirmDueAt(fk: GraduationConfirmState): Date {
  const last = fk.graduationConfirmedAt ?? fk.createdAt
  return new Date(last.getTime() + GRADUATION_CONFIRM_DAYS * DAY_MS)
}

export function graduationConfirmDue(
  fk: GraduationConfirmState,
  now: Date
): boolean {
  if (fk.state === 'drained' || fk.state === 'lost') return false
  return now.getTime() >= graduationConfirmDueAt(fk).getTime()
}

export function graduationPromptEmailDue(
  fk: GraduationConfirmState,
  now: Date
): boolean {
  if (!graduationConfirmDue(fk, now)) return false
  return (
    !fk.graduationPromptSentAt ||
    fk.graduationPromptSentAt.getTime() < graduationConfirmDueAt(fk).getTime()
  )
}
