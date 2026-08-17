import { createServerFn } from '@tanstack/react-start'

/**
 * Club timezone (UTC+5). All calendar event payloads and rendered timestamps
 * use the club's local time so events show up at the correct local time.
 */
export const CLUB_TIMEZONE = 'Asia/Karachi'

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

/**
 * Authenticated wrapper around checkCalendarFreeBusyRaw. Read-only; used by the
 * client equipment pages. Mutating calendar operations are NOT exposed as
 * server fns (see google-calendar-client.ts) so they cannot be called by
 * unauthenticated clients.
 */
export const checkCalendarFreeBusy = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { requireAuthenticatedUser } = await import('@/lib/auth/require-auth')
    await requireAuthenticatedUser()
    const { checkCalendarFreeBusyRaw } =
      await import('./google-calendar-client')
    const { calendarId, timeMin, timeMax } = data
    return checkCalendarFreeBusyRaw({ calendarId, timeMin, timeMax })
  })

/**
 * Authenticated wrapper around checkMultipleCalendarsFreeBusyRaw.
 */
export const checkMultipleCalendarsFreeBusy = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { requireAuthenticatedUser } = await import('@/lib/auth/require-auth')
    await requireAuthenticatedUser()
    const { checkMultipleCalendarsFreeBusyRaw } =
      await import('./google-calendar-client')
    const { equipmentCalendarIds, timeMin, timeMax } = data
    return checkMultipleCalendarsFreeBusyRaw({
      equipmentCalendarIds,
      timeMin,
      timeMax,
    })
  })

/**
 * Authenticated wrapper around getCalendarEventsRaw.
 */
export const getCalendarEvents = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { requireAuthenticatedUser } = await import('@/lib/auth/require-auth')
    await requireAuthenticatedUser()
    const { getCalendarEventsRaw } = await import('./google-calendar-client')
    const { equipmentCalendarId, timeMin, timeMax, maxResults = 250 } = data
    return getCalendarEventsRaw({
      equipmentCalendarId,
      timeMin,
      timeMax,
      maxResults,
    })
  })
