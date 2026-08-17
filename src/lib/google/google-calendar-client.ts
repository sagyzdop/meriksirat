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
}): Promise<{ [key: string]: { busy: any[] } }> {
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

  const output: { [key: string]: { busy: any[] } } = {}

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
}): Promise<any[]> {
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

  const result = (await response.json()) as { items?: any[] }
  return result.items || []
}

/**
 * Insert an event into a calendar.
 */
export async function createCalendarEventRaw(args: {
  equipmentCalendarId: string
  event: any
  userEmail?: string
}): Promise<{ success: boolean; eventId: string; event: any }> {
  const { equipmentCalendarId, event, userEmail = '' } = args

  const accessToken = await getGoogleAccessToken()

  const eventWithAttendee = {
    ...event,
    attendees: [...(event.attendees || []), { email: userEmail }],
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      equipmentCalendarId
    )}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventWithAttendee),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Calendar API error:', error)
    throw new Error(`Failed to create calendar event: ${error}`)
  }

  const createdEvent = (await response.json()) as any

  return { success: true, eventId: createdEvent.id, event: createdEvent }
}

/**
 * Patch (partially update) an existing event.
 */
export async function updateCalendarEventRaw(args: {
  equipmentCalendarId: string
  eventId: string
  event: any
  userEmail?: string
}): Promise<{ success: boolean; event: any }> {
  const { equipmentCalendarId, eventId, event, userEmail = '' } = args

  const accessToken = await getGoogleAccessToken()

  const updatedEvent = { ...event }
  if (userEmail) {
    updatedEvent.attendees = [...(event.attendees || []), { email: userEmail }]
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      equipmentCalendarId
    )}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedEvent),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update calendar event: ${error}`)
  }

  const result = (await response.json()) as any
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
    )}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
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
