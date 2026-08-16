import { CLUB_TIMEZONE } from '@/lib/google/google-caledar'

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
 */
export function clubLocalToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(guess)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  const clubAsUtc = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  )
  const offsetMs = clubAsUtc - guess.getTime()
  return new Date(guess.getTime() + offsetMs)
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
