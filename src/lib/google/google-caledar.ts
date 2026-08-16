import { createServerFn } from '@tanstack/react-start'
import { getGoogleAccessToken } from './google-calendar-auth'

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
 * Check freeBusy for a specific equipment calendar using REST API
 * Reference: https://developers.google.com/calendar/api/v3/reference/freebusy/query
 */
export const checkCalendarFreeBusy = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { calendarId, timeMin, timeMax } = data
    
    const accessToken = await getGoogleAccessToken()
    
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to check calendar availability: ${error}`)
    }
    
    const result = await response.json() as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
    }
    const calendars = result.calendars ?? {}
    const cal = calendars[calendarId] ?? { busy: [] }
    
    return { busy: cal.busy ?? [] }
  })

/**
 * Create event in a specific equipment calendar using REST API
 * Reference: https://developers.google.com/calendar/api/v3/reference/events/insert
 */
export const createCalendarEvent = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { equipmentCalendarId, event, userEmail } = data

    const accessToken = await getGoogleAccessToken()
    
    const eventWithAttendee = {
      ...event,
      attendees: [
        ...(event.attendees || []),
        { email: userEmail }
      ]
    }
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(equipmentCalendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
    
    const createdEvent = await response.json() as any

    return { success: true, eventId: createdEvent.id, event: createdEvent }
  })

/**
 * Update an existing event using REST API (partial PATCH so only the provided
 * fields change, including the event's real start/end times).
 * Reference: https://developers.google.com/calendar/api/v3/reference/events/patch
 */
export const updateCalendarEvent = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { equipmentCalendarId, eventId, event, userEmail } = data
    
    const accessToken = await getGoogleAccessToken()
    
    let updatedEvent = { ...event }
    if (userEmail) {
      updatedEvent.attendees = [
        ...(event.attendees || []),
        { email: userEmail }
      ]
    }
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(equipmentCalendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEvent),
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to update calendar event: ${error}`)
    }
    
    const result = await response.json() as any
    return { success: true, event: result }
  })

/**
 * Delete an event using REST API
 * Reference: https://developers.google.com/calendar/api/v3/reference/events/delete
 */
export const deleteCalendarEvent = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { equipmentCalendarId, eventId } = data
    
    const accessToken = await getGoogleAccessToken()
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(equipmentCalendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to delete calendar event: ${error}`)
    }
    
    return { success: true }
  })

/**
 * Get events from a calendar using REST API
 * Reference: https://developers.google.com/calendar/api/v3/reference/events/list
 */
export const getCalendarEvents = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { equipmentCalendarId, timeMin, timeMax, maxResults = 250 } = data
    
    const accessToken = await getGoogleAccessToken()
    
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    })
    
    if (timeMin) params.append('timeMin', timeMin)
    if (timeMax) params.append('timeMax', timeMax)
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(equipmentCalendarId)}/events?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get calendar events: ${error}`)
    }
    
    const result = await response.json() as { items?: any[] }
    return result.items || []
  })

/**
 * Check freeBusy for multiple calendars using REST API
 */
export const checkMultipleCalendarsFreeBusy = createServerFn({ method: 'POST' })
  .validator((d: any) => d)
  .handler(async ({ data }) => {
    const { equipmentCalendarIds, timeMin, timeMax } = data

    // Google's free/busy API silently drops busy data for some calendars when
    // a request carries more than ~20 items (its documented limit is 50). Batch
    // the request into small chunks and merge so every calendar is checked.
    const MAX_CALENDARS_PER_REQUEST = 15

    const accessToken = await getGoogleAccessToken()

    const chunks: string[][] = []
    for (let i = 0; i < equipmentCalendarIds.length; i += MAX_CALENDARS_PER_REQUEST) {
      chunks.push(equipmentCalendarIds.slice(i, i + MAX_CALENDARS_PER_REQUEST))
    }

    const output: { [key: string]: { busy: any[] } } = {}

    await Promise.all(
      chunks.map(async (chunk) => {
        const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: chunk.map((id: string) => ({ id })),
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Failed to check calendars availability: ${error}`)
        }

        const result = await response.json() as {
          calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
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
  })

/**
 * Builds the all-day annual payload for a member birthday event. Birthdays are
 * recurring so we attach an `RRULE:FREQ=YEARLY` and keep a single event per
 * member. The member id is embedded in the description so a reconcile pass can
 * match calendar events back to D1 users. `date` is `YYYY-MM-DD`; the year is
 * cosmetic (2000) since Google drives recurrence from month/day.
 */
export function buildBirthdayEventBody(input: {
  userId: string
  name: string
  date: string
}): {
  summary: string
  description: string
  start: { date: string }
  end: { date: string }
  recurrence: string[]
} {
  const startDate = new Date(`${input.date}T00:00:00Z`)
  const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
  const toDate = (d: Date) => d.toISOString().split('T')[0]
  return {
    summary: `🎂 ${input.name}`,
    description: `meriksiratUserId=${input.userId}`,
    start: { date: toDate(startDate) },
    end: { date: toDate(endDate) },
    recurrence: ['RRULE:FREQ=YEARLY'],
  }
}

/**
 * Create an all-day annual birthday event on the birthdays calendar. Not a
 * createServerFn so both server fns and the scheduled handler can call it.
 */
export async function createBirthdayEvent(
  calendarId: string,
  input: { userId: string; name: string; date: string }
): Promise<{ eventId: string }> {
  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildBirthdayEventBody(input)),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to create birthday event: ${await response.text()}`)
  }

  const event = (await response.json()) as { id: string }
  return { eventId: event.id }
}

/**
 * List all events on the birthdays calendar. The calendar is dedicated to
 * birthdays and `singleEvents=false` returns each recurring series once.
 */
export async function listBirthdayEvents(
  calendarId: string
): Promise<
  Array<{
    id: string
    summary?: string
    description?: string
    start?: { date?: string }
  }>
> {
  const accessToken = await getGoogleAccessToken()

  const params = new URLSearchParams({
    maxResults: '2500',
    singleEvents: 'false',
  })

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to list birthday events: ${await response.text()}`)
  }

  const result = (await response.json()) as {
    items?: Array<{
      id: string
      summary?: string
      description?: string
      start?: { date?: string }
    }>
  }
  return result.items ?? []
}

/**
 * Update a birthday event (summary / date) after a member edits their birthday.
 */
export async function updateBirthdayEvent(
  calendarId: string,
  eventId: string,
  event: {
    summary: string
    description: string
    start: { date: string }
    end: { date: string }
  }
): Promise<void> {
  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to update birthday event: ${await response.text()}`)
  }
}

/**
 * Delete a birthday event after a member loses Active/Board status.
 */
export async function deleteBirthdayEvent(
  calendarId: string,
  eventId: string
): Promise<void> {
  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to delete birthday event: ${await response.text()}`)
  }
}

