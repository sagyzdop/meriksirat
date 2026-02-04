import { createServerFn } from '@tanstack/react-start'
import { getGoogleAccessToken } from './google-calendar-auth'

/**
 * Check freeBusy for a specific equipment calendar using REST API
 * Reference: https://developers.google.com/calendar/api/v3/reference/freebusy/query
 */
export const checkCalendarFreeBusy = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
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
  .inputValidator((d: any) => d)
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
 * Update an existing event using REST API
 * Reference: https://developers.google.com/calendar/api/v3/reference/events/update
 */
export const updateCalendarEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
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
        method: 'PUT',
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
  .inputValidator((d: any) => d)
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
  .inputValidator((d: any) => d)
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
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const { equipmentCalendarIds, timeMin, timeMax } = data
    
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
        items: equipmentCalendarIds.map((id: string) => ({ id })),
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
    const output: { [key: string]: { busy: any[] } } = {}
    
    equipmentCalendarIds.forEach((calendarId: string) => {
      output[calendarId] = {
        busy: calendars[calendarId]?.busy ?? []
      }
    })
    
    return output
  })

/**
 * Generate an authenticated calendar embed URL for Google Calendar
 * This uses the server-side access token to create a special token-based URL
 * that allows unauthenticated users to view the calendar without redirecting to signin
 * 
 * Reference: https://developers.google.com/calendar/api/v3/reference
 */
export const getAuthenticatedCalendarEmbedUrl = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const { calendarId } = data
    
    if (!calendarId) {
      throw new Error('Calendar ID is required')
    }

    try {
      const accessToken = await getGoogleAccessToken()
      
      // Build the standard embed URL with parameters
      const baseUrl = 'https://calendar.google.com/calendar/embed'
      const params = new URLSearchParams({
        height: '600',
        wkst: '1',
        ctz: 'Asia/Almaty',
        showPrint: '0',
        mode: 'WEEK',
        showCalendars: '0',
        showTz: '0',
        src: calendarId,
        color: '#7986cb',
        access_token: accessToken, // Include token as parameter
      })
      
      const embeddableUrl = `${baseUrl}?${params.toString()}`
      return { url: embeddableUrl }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate calendar URL'
      throw new Error(`Failed to generate authenticated calendar URL: ${errorMessage}`)
    }
  })
