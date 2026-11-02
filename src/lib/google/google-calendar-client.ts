/**
 * Raw Google Calendar API client (server-side only).
 *
 * These functions perform Google Calendar HTTP calls with the master
 * credentials. They are deliberately NOT createServerFn RPCs: server functions
 * are reachable over HTTP by anyone, which would let an unauthenticated caller
 * create/update/delete calendar events and burn Google API quota. Only booking
 * server fns and the scheduled handler should import this module.
 *
 * Arguments are plain objects (no `data:` wrapper, unlike the old server fns).
 */

import { getGoogleAccessToken } from './google-calendar-auth'

type CalendarBusyPeriod = { start: string; end: string }

type CalendarEvent = {
  id: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  status?: string
}

type CalendarEventInput = {
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  [key: string]: unknown
}

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const MAX_CALENDARS_PER_REQUEST = 15

async function calendarFetch(
  path: string,
  init: { method: string; body?: unknown; token?: string; logError?: boolean },
  failure: string
): Promise<Response> {
  const accessToken = init.token ?? (await getGoogleAccessToken())

  const response = await fetch(`${CALENDAR_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (!response.ok) {
    const error = await response.text()
    if (init.logError) console.error('Calendar API error:', error)
    throw new Error(`${failure}: ${error}`)
  }

  return response
}

const eventPath = (calendarId: string, eventId?: string) =>
  `/calendars/${encodeURIComponent(calendarId)}/events${
    eventId === undefined ? '' : `/${encodeURIComponent(eventId)}`
  }`

async function freeBusy(
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
  failure: string
): Promise<{ [key: string]: { busy: CalendarBusyPeriod[] } }> {
  const token = await getGoogleAccessToken()

  const chunks: string[][] = []
  for (let i = 0; i < calendarIds.length; i += MAX_CALENDARS_PER_REQUEST) {
    chunks.push(calendarIds.slice(i, i + MAX_CALENDARS_PER_REQUEST))
  }

  const output: { [key: string]: { busy: CalendarBusyPeriod[] } } = {}

  await Promise.all(
    chunks.map(async (chunk) => {
      const response = await calendarFetch(
        '/freeBusy',
        {
          method: 'POST',
          body: { timeMin, timeMax, items: chunk.map((id) => ({ id })) },
          token,
        },
        failure
      )

      const result = (await response.json()) as {
        calendars?: Record<string, { busy?: CalendarBusyPeriod[] }>
      }
      const calendars = result.calendars ?? {}

      for (const calendarId of chunk) {
        output[calendarId] = { busy: calendars[calendarId]?.busy ?? [] }
      }
    })
  )

  return output
}

export async function checkCalendarFreeBusyRaw(args: {
  calendarId: string
  timeMin: string
  timeMax: string
}): Promise<{ busy: CalendarBusyPeriod[] }> {
  const { calendarId, timeMin, timeMax } = args
  const result = await freeBusy(
    [calendarId],
    timeMin,
    timeMax,
    'Failed to check calendar availability'
  )
  return result[calendarId]
}

export async function checkMultipleCalendarsFreeBusyRaw(args: {
  equipmentCalendarIds: string[]
  timeMin: string
  timeMax: string
}): Promise<{ [key: string]: { busy: CalendarBusyPeriod[] } }> {
  const { equipmentCalendarIds, timeMin, timeMax } = args
  return freeBusy(
    equipmentCalendarIds,
    timeMin,
    timeMax,
    'Failed to check calendars availability'
  )
}

export async function getCalendarEventsRaw(args: {
  equipmentCalendarId: string
  timeMin?: string
  timeMax?: string
  maxResults?: number
}): Promise<CalendarEvent[]> {
  const { equipmentCalendarId, timeMin, timeMax, maxResults = 250 } = args

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  if (timeMin) params.append('timeMin', timeMin)
  if (timeMax) params.append('timeMax', timeMax)

  const response = await calendarFetch(
    `${eventPath(equipmentCalendarId)}?${params}`,
    { method: 'GET' },
    'Failed to get calendar events'
  )

  const result = (await response.json()) as { items?: CalendarEvent[] }
  return result.items || []
}

/**
 * Insert an event into a calendar and return its id.
 *
 * Events are created WITHOUT attendees and with `sendUpdates=none`: the user
 * must not get an email per equipment event. The member is identified in the
 * event description instead.
 */
export async function createCalendarEventRaw(args: {
  equipmentCalendarId: string
  event: CalendarEventInput
}): Promise<string> {
  const { equipmentCalendarId, event } = args

  const response = await calendarFetch(
    `${eventPath(equipmentCalendarId)}?sendUpdates=none`,
    { method: 'POST', body: event, logError: true },
    'Failed to create calendar event'
  )

  return ((await response.json()) as CalendarEvent).id
}

/**
 * Patch (partially update) an existing event.
 *
 * No attendees are added and `sendUpdates=none` keeps Google from emailing the
 * member about status changes (started / returned / extended).
 */
export async function updateCalendarEventRaw(args: {
  equipmentCalendarId: string
  eventId: string
  event: CalendarEventInput
}): Promise<void> {
  const { equipmentCalendarId, eventId, event } = args

  await calendarFetch(
    `${eventPath(equipmentCalendarId, eventId)}?sendUpdates=none`,
    { method: 'PATCH', body: event },
    'Failed to update calendar event'
  )
}

export async function deleteCalendarEventRaw(args: {
  equipmentCalendarId: string
  eventId: string
}): Promise<void> {
  const { equipmentCalendarId, eventId } = args

  await calendarFetch(
    `${eventPath(equipmentCalendarId, eventId)}?sendUpdates=none`,
    { method: 'DELETE' },
    'Failed to delete calendar event'
  )
}
