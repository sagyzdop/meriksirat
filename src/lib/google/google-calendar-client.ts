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

/**
 * Check freeBusy for a single calendar.
 */
export async function checkCalendarFreeBusyRaw(args: {
  calendarId: string
  timeMin: string
  timeMax: string
}): Promise<{ busy: Array<{ start: string; end: string }> }> {
  const { calendarId, timeMin, timeMax } = args

  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/freeBusy',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to check calendar availability: ${error}`)
  }

  const result = (await response.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
  }
  const calendars = result.calendars ?? {}
  const cal = calendars[calendarId] ?? { busy: [] }

  return { busy: cal.busy ?? [] }
}

/**
 * Check freeBusy for multiple calendars, batching to stay under Google's
 * ~50-item limit (batches of 15 because the API silently drops busy data for
 * some calendars on large requests).
 */
export async function checkMultipleCalendarsFreeBusyRaw(args: {
  equipmentCalendarIds: string[]
  timeMin: string
  timeMax: string
}): Promise<{ [key: string]: { busy: CalendarBusyPeriod[] } }> {
  const { equipmentCalendarIds, timeMin, timeMax } = args

  const MAX_CALENDARS_PER_REQUEST = 15

  const accessToken = await getGoogleAccessToken()

  const chunks: string[][] = []
  for (
    let i = 0;
    i < equipmentCalendarIds.length;
    i += MAX_CALENDARS_PER_REQUEST
  ) {
    chunks.push(equipmentCalendarIds.slice(i, i + MAX_CALENDARS_PER_REQUEST))
  }

  const output: { [key: string]: { busy: CalendarBusyPeriod[] } } = {}

  await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: chunk.map((id: string) => ({ id })),
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to check calendars availability: ${error}`)
      }

      const result = (await response.json()) as {
        calendars?: Record<
          string,
          { busy?: Array<{ start: string; end: string }> }
        >
      }
      const calendars = result.calendars ?? {}

      chunk.forEach((calendarId: string) => {
        output[calendarId] = {
          busy: calendars[calendarId]?.busy ?? [],
        }
      })
    })
  )

  return output
}

/**
 * List events from a calendar.
 */
export async function getCalendarEventsRaw(args: {
  equipmentCalendarId: string
  timeMin?: string
  timeMax?: string
  maxResults?: number
}): Promise<CalendarEvent[]> {
  const { equipmentCalendarId, timeMin, timeMax, maxResults = 250 } = args

  const accessToken = await getGoogleAccessToken()

  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  if (timeMin) params.append('timeMin', timeMin)
  if (timeMax) params.append('timeMax', timeMax)

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      equipmentCalendarId
    )}/events?${params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get calendar events: ${error}`)
  }

  const result = (await response.json()) as { items?: CalendarEvent[] }
  return result.items || []
}

/**
 * Insert an event into a calendar.
 *
 * Events are created WITHOUT attendees and with `sendUpdates=none`: the user
 * must not get an email per equipment event. The member is identified in the
 * event description instead.
 */
export async function createCalendarEventRaw(args: {
  equipmentCalendarId: string
  event: CalendarEventInput
}): Promise<{ success: boolean; eventId: string; event: CalendarEvent }> {
  const { equipmentCalendarId, event } = args

  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      equipmentCalendarId
    )}/events?sendUpdates=none`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Calendar API error:', error)
    throw new Error(`Failed to create calendar event: ${error}`)
  }

  const createdEvent = (await response.json()) as CalendarEvent

  return { success: true, eventId: createdEvent.id, event: createdEvent }
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
}): Promise<{ success: boolean; event: CalendarEvent }> {
  const { equipmentCalendarId, eventId, event } = args

  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      equipmentCalendarId
    )}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update calendar event: ${error}`)
  }

  const result = (await response.json()) as CalendarEvent
  return { success: true, event: result }
}

/**
 * Delete an event from a calendar.
 */
export async function deleteCalendarEventRaw(args: {
  equipmentCalendarId: string
  eventId: string
}): Promise<{ success: boolean }> {
  const { equipmentCalendarId, eventId } = args

  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      equipmentCalendarId
    )}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete calendar event: ${error}`)
  }

  return { success: true }
}
