import { CLUB_TIMEZONE } from '@/lib/google/google-caledar'
import { minutesToTime } from './functions/settings'

/**
 * Club-local wall-clock helpers used to enforce operating hours.
 *
 * Operating hours are stored as minutes since midnight in the club's local
 * timezone (CLUB_TIMEZONE, Asia/Karachi). All comparisons must use the club
 * timezone so that e.g. a booking ending at 23:30 cannot be extended into the
 * next club day.
 */

export interface ClubLocalParts {
  /** `YYYY-MM-DD` in the club timezone */
  dateKey: string
  /** Minutes since midnight in the club timezone (0-1439) */
  minutes: number
}

/** Returns the club-local date key and minutes-since-midnight for a Date. */
export function getClubLocalParts(date: Date | string): ClubLocalParts {
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/**
 * Converts a club-local wall-clock time (`YYYY-MM-DD` + `HH:mm`) into the
 * absolute UTC Date it refers to. Used to build the `timeMin`/`timeMax`
 * arguments for the Google Calendar free/busy API.
 *
 * The naive guess (the wall-clock time read as UTC) is corrected by the club
 * offset: `utc = naive - offset`. Two passes converge exactly even for DST
 * zones; Asia/Karachi has a fixed UTC+5 offset so a single pass is exact.
 */
export function clubLocalToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00'

  let guess = new Date(naiveUtc)
  for (let i = 0; i < 2; i++) {
    const parts = formatter.formatToParts(guess)
    const clubAsUtc = Date.UTC(
      Number(get(parts, 'year')),
      Number(get(parts, 'month')) - 1,
      Number(get(parts, 'day')),
      Number(get(parts, 'hour')),
      Number(get(parts, 'minute')),
      Number(get(parts, 'second'))
    )
    guess = new Date(naiveUtc - (clubAsUtc - guess.getTime()))
  }
  return guess
}

export interface ThirtyMinuteExtensionCheck {
  allowed: boolean
  reason?: 'midnight' | 'operating-hours'
}

/**
 * Checks whether extending a booking by 30 minutes from `endTime` stays within
 * the same club-local day and within the configured operating hours.
 */
export function checkThirtyMinuteExtension(
  endTime: Date | string,
  operatingHoursEnd: number
): ThirtyMinuteExtensionCheck {
  const { minutes } = getClubLocalParts(endTime)
  const newMinutes = minutes + 30
  if (newMinutes > 1439) return { allowed: false, reason: 'midnight' }
  if (newMinutes > operatingHoursEnd) {
    return { allowed: false, reason: 'operating-hours' }
  }
  return { allowed: true }
}

export interface BookableWindow {
  /** `YYYY-MM-DD` in the club timezone */
  dateKey: string
  /** `HH:mm` club-local start time */
  startTime: string
  /** `HH:mm` club-local end time */
  endTime: string
}

/** Bookings must start at least this far in the future (1 hour). */
export const MIN_BOOKING_ADVANCE_MS = 60 * 60 * 1000

/** A single booking may not run longer than this (48 hours). */
export const MAX_BOOKING_DURATION_MS = 48 * 60 * 60 * 1000

/** Bookings may not start further in the future than this (60 days). */
export const MAX_BOOKING_HORIZON_MS = 60 * 24 * 60 * 60 * 1000

/** Maximum number of equipment items allowed per booking. */
export const MAX_BOOKING_ITEMS = 10

/**
 * Returns the nearest 30-minute window that can be booked right now. A booking
 * must start at least `MIN_BOOKING_ADVANCE_MS` from now, so the earliest start
 * is the next half-hour boundary after now + the advance, clamped to the start
 * of the operating hours and rolled over to the next club day when the
 * remaining hours today cannot fit a full 30-minute slot.
 */
export function getNextBookableWindow(
  operatingHoursStart = 0,
  operatingHoursEnd = 1439
): BookableWindow {
  const now = getClubLocalParts(new Date())
  const advanceMinutes = MIN_BOOKING_ADVANCE_MS / (60 * 1000)
  const earliestStart = Math.min(now.minutes + advanceMinutes, 1439)
  const boundary = Math.max(
    Math.ceil(earliestStart / 30) * 30,
    operatingHoursStart
  )
  const fitsToday = boundary + 30 <= operatingHoursEnd

  const startMinutes = fitsToday ? boundary : operatingHoursStart
  const endMinutes =
    operatingHoursEnd - operatingHoursStart >= 30
      ? startMinutes + 30
      : operatingHoursEnd

  const dateKey = fitsToday
    ? now.dateKey
    : getClubLocalParts(
        new Date(
          clubLocalToUtc(now.dateKey, '00:00').getTime() + 24 * 60 * 60 * 1000
        )
      ).dateKey

  return {
    dateKey,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
  }
}
