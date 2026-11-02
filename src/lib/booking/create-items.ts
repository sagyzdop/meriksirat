import { eq, inArray } from 'drizzle-orm'
import type { db } from '@/db'
import { bookingItem, equipment } from '@/db/schema'
import {
  checkMultipleCalendarsFreeBusyRaw,
  createCalendarEventRaw,
  deleteCalendarEventRaw,
} from '@/lib/google/google-calendar-client'
import { formatBookingDetailsPlain } from './details'
import { CLUB_TIMEZONE, toCalendarDateTime } from '@/lib/google/google-caledar'

type Database = ReturnType<typeof db>

export interface BookableEquipment {
  equipmentId: number
  calendarId: string
  name: string
}

export interface Conflict {
  equipmentId: number
  conflict: { start: string; end: string }
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  const retries = 3
  const backoffMs = 400
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)))
    }
  }
  throw lastErr
}

export async function loadBookableEquipment(
  database: Database,
  equipmentIds: number[]
): Promise<BookableEquipment[]> {
  const rows = await database
    .select({
      id: equipment.id,
      modelName: equipment.modelName,
      googleCalendarId: equipment.googleCalendarId,
    })
    .from(equipment)
    .where(inArray(equipment.id, equipmentIds))
  const byId = new Map(rows.map((row) => [row.id, row]))

  return equipmentIds.map((equipmentId) => {
    const row = byId.get(equipmentId)
    if (!row?.googleCalendarId) {
      throw new Error(`No calendar configured for equipment ${equipmentId}`)
    }
    return {
      equipmentId,
      calendarId: row.googleCalendarId,
      name: row.modelName || `Equipment ${equipmentId}`,
    }
  })
}

export async function assertNoConflicts(
  items: BookableEquipment[],
  startTime: string,
  endTime: string,
  describe: (conflicts: Conflict[]) => string
): Promise<void> {
  const freeBusy = await checkMultipleCalendarsFreeBusyRaw({
    equipmentCalendarIds: items.map((item) => item.calendarId),
    timeMin: startTime,
    timeMax: endTime,
  })

  const conflicts: Conflict[] = []
  for (const { equipmentId, calendarId } of items) {
    const busy = freeBusy[calendarId]?.busy || []
    if (busy.length > 0) conflicts.push({ equipmentId, conflict: busy[0] })
  }

  if (conflicts.length > 0) {
    const err: Error & { conflicts?: Conflict[] } = new Error(
      describe(conflicts)
    )
    err.conflicts = conflicts
    throw err
  }
}

export async function createItemsWithEvents(
  database: Database,
  params: {
    bookingId: number
    items: BookableEquipment[]
    startTime: string
    endTime: string
    ownerName: string
    notes: string | null | undefined
    now: number
  }
): Promise<number> {
  const { bookingId, items, startTime, endTime, ownerName, notes, now } = params
  const created: Array<{
    bookingItemId: number
    calendarId: string
    eventId: string
  }> = []

  try {
    for (const { equipmentId, calendarId, name } of items) {
      const event = {
        summary: `${name} - Booking`,
        description: formatBookingDetailsPlain({
          bookingId,
          userDisplayName: ownerName,
          equipmentNames: [name],
          startTime,
          endTime,
          status: 'booked',
          notes,
        }),
        start: {
          dateTime: toCalendarDateTime(startTime),
          timeZone: CLUB_TIMEZONE,
        },
        end: {
          dateTime: toCalendarDateTime(endTime),
          timeZone: CLUB_TIMEZONE,
        },
      }

      const createdEvent = await retry(() =>
        createCalendarEventRaw({ equipmentCalendarId: calendarId, event })
      )

      const eventId = createdEvent?.eventId
      if (!eventId) {
        throw new Error('Calendar API responded without event id')
      }

      const [inserted] = await database
        .insert(bookingItem)
        .values({
          bookingId,
          equipmentId,
          status: 'booked',
          googleCalendarEventId: eventId,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
        .returning({ id: bookingItem.id })

      if (!inserted?.id) {
        throw new Error('Failed to create booking item record')
      }

      created.push({ bookingItemId: inserted.id, calendarId, eventId })
    }
  } catch (err) {
    for (const record of created) {
      try {
        await deleteCalendarEventRaw({
          equipmentCalendarId: record.calendarId,
          eventId: record.eventId,
        })
      } catch (deleteError) {
        console.error(
          'Failed to delete calendar event during rollback:',
          deleteError
        )
      }

      try {
        await database
          .delete(bookingItem)
          .where(eq(bookingItem.id, record.bookingItemId))
      } catch (dbDelErr) {
        console.error(
          'Rollback delete failed for booking item',
          record.bookingItemId,
          dbDelErr
        )
      }
    }

    throw err
  }

  return created.length
}
