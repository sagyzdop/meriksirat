import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

/**
 * Authenticated wrapper around checkCalendarFreeBusyRaw. Read-only; used by the
 * client equipment pages. Mutating calendar operations are NOT exposed as
 * server fns (see google-calendar-client.ts) so they cannot be called by
 * unauthenticated clients.
 */
export const checkCalendarFreeBusy = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      calendarId: z.string(),
      timeMin: z.string(),
      timeMax: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    await userContext('Not authenticated')
    const { checkCalendarFreeBusyRaw } =
      await import('./google-calendar-client')
    const { calendarId, timeMin, timeMax } = data
    return checkCalendarFreeBusyRaw({ calendarId, timeMin, timeMax })
  })

/**
 * Authenticated wrapper around checkMultipleCalendarsFreeBusyRaw.
 */
export const checkMultipleCalendarsFreeBusy = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      equipmentCalendarIds: z.array(z.string()),
      timeMin: z.string(),
      timeMax: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    await userContext('Not authenticated')
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
  .validator(
    z.object({
      equipmentCalendarId: z.string(),
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
      maxResults: z.number().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { userContext } = await import('@/lib/auth/context')
    await userContext('Not authenticated')
    const { getCalendarEventsRaw } = await import('./google-calendar-client')
    const { equipmentCalendarId, timeMin, timeMax, maxResults = 250 } = data
    return getCalendarEventsRaw({
      equipmentCalendarId,
      timeMin,
      timeMax,
      maxResults,
    })
  })
