export const CLUB_TIMEZONE = 'Asia/Almaty'

export function formatClubTime(date: Date, hour12: boolean): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: CLUB_TIMEZONE,
  })
}

export function formatLongDate(
  date: Date | null,
  timeZone: string = CLUB_TIMEZONE
): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  })
}

/**
 * Formats a Date (or ISO string) as the club's local wall-clock time,
 * `YYYY-MM-DDTHH:mm:ss` with no offset. Paired with `timeZone: CLUB_TIMEZONE`
 * in event payloads, Google interprets it as club-local time. The naive
 * string avoids the `Z` + `timeZone` combination that the Calendar API
 * rejects on update (400), which previously left the event times unchanged.
 */
export function toCalendarDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}
