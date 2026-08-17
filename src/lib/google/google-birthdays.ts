/**
 * Birthday calendar helpers (server-only).
 *
 * These functions perform Google Calendar HTTP calls with the master
 * credentials. They live in their own module so they are never bundled into
 * the client (unlike google-caledar.ts, which client components import).
 */

import { getGoogleAccessToken } from './google-calendar-auth'

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
 * Create an all-day annual birthday event on the birthdays calendar.
 */
export async function createBirthdayEvent(
  calendarId: string,
  input: { userId: string; name: string; date: string }
): Promise<{ eventId: string }> {
  const accessToken = await getGoogleAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
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
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to delete birthday event: ${await response.text()}`)
  }
}
